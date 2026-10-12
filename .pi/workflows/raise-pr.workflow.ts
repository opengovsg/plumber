import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  action,
  agent,
  defineWorkflow,
  idempotentEffect,
  manualEffect,
  shell,
} from '@osolmaz/pi-workflows'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

type ReviewResult = {
  tasks: { id: string; title: string }[]
  summary: string
}

const openTaskSchema = z.object({ number: z.number(), title: z.string() })
type OpenTask = z.infer<typeof openTaskSchema>

const verdictSchema = z.object({
  verdict: z.enum(['agent', 'human']),
  reason: z.string(),
})

type JudgedTask = OpenTask & { id: string; reason: string }

type JudgeResult = {
  agentTasks: JudgedTask[]
  blockedTasks: JudgedTask[]
  unjudgedTasks: JudgedTask[]
}

type TaskFixResult = {
  id: string
  title: string
  ok: boolean
  report: string
}

export default defineWorkflow({
  name: 'raise-pr',
  startAt: 'create-pr',
  nodes: {
    'create-pr': agent({
      prompt: () =>
        [
          'Use the write-pr skill to raise a PR for the current branch.',
          'Read ~/.claude/skills/write-pr/SKILL.md first and follow it exactly.',
          'Create the PR with `gh pr create`, or update the existing one with `gh pr edit`.',
        ].join('\n'),
      expectedOutput: `{ "prUrl": "https://github.com/...", "action": "created" | "updated" }`,
      timeoutMs: 10 * 60_000,
    }),
    'list-open-tasks': shell({
      effect: idempotentEffect('tsk.list-open'),
      exec: () => ({
        command: 'tsk',
        args: ['list', '--open', '--json'],
        timeoutMs: 30_000,
      }),
      parse: (result): OpenTask[] =>
        z.array(openTaskSchema).parse(JSON.parse(result.stdout)),
      timeoutMs: 60_000,
    }),
    // Sub-agents run one at a time because they all edit the same working tree.
    'fix-tasks': action({
      // IMPORTANT: a sub-agent may have edited files before an uncertain exit, so recovery must not rerun blindly.
      effect: manualEffect('fix-tasks.sub-agents'),
      run: async ({ outputs, signal, publishUpdate }) => {
        const tasks = (outputs.judge as JudgeResult).agentTasks
        const results: TaskFixResult[] = []
        for (const [index, task] of tasks.entries()) {
          const id = `T${task.number}`
          await publishUpdate({
            type: 'progress',
            key: 'fix-tasks',
            data: {
              schema: 'pi-workflows.progress.v1',
              label: 'Fix open tasks',
              status: 'running',
              phase: `${id}: ${task.title}`,
              completed: index,
              total: tasks.length,
              unit: 'tasks',
            },
          })
          const prompt = [
            `Fix tsk task ${id}: ${task.title}`,
            `Run \`tsk list ${id} --json\` for its notes and steps, then \`tsk status ${id} start\`.`,
            'Follow AGENTS.md. Run lint and tests for the workspace you touch.',
            'Leave changes uncommitted. Do not push.',
            `When done, run \`tsk status ${id} review\`. If blocked, run \`tsk status ${id} blocked\`.`,
            'End with a short report of what you changed.',
          ].join('\n')
          try {
            const { stdout } = await execFileAsync(
              'pi',
              ['-p', '--no-session', prompt],
              { signal, timeout: 20 * 60_000, maxBuffer: 10_000_000 },
            )
            results.push({
              id,
              title: task.title,
              ok: true,
              report: stdout.trim().slice(-2_000),
            })
          } catch (error) {
            if (signal.aborted) throw error
            results.push({
              id,
              title: task.title,
              ok: false,
              report: String(error).slice(-2_000),
            })
          }
        }
        await publishUpdate({
          type: 'progress',
          key: 'fix-tasks',
          data: {
            schema: 'pi-workflows.progress.v1',
            label: 'Fix open tasks',
            status: 'completed',
            completed: tasks.length,
            total: tasks.length,
            unit: 'tasks',
          },
        })
        return { results }
      },
      timeoutMs: 3 * 60 * 60_000,
    }),
    // Agent steps run on the origin session's model, so a headless pi run pins the review model.
    'adversarial-review': shell({
      // IMPORTANT: `tsk add` may have filed tasks before an uncertain exit, so recovery must not rerun blindly.
      effect: manualEffect('adversarial-review.tsk-tasks'),
      exec: ({ outputs }) => ({
        command: 'pi',
        args: [
          '-p',
          '--no-session',
          '--model',
          'openai/gpt-6.1-sol',
          '--thinking',
          'medium',
          [
            `Use the adversarial-review skill to review the changes in ${(outputs['create-pr'] as { prUrl: string }).prUrl}.`,
            'Read .claude/skills/adversarial-review/SKILL.md first and follow it exactly.',
            'File each finding as a task with `tsk add`.',
            'End your reply with a fenced ```json block containing exactly:',
            '{ "tasks": [{ "id": "T12", "title": "short finding" }], "summary": "one-line verdict" }',
          ].join('\n'),
        ],
        timeoutMs: 15 * 60_000,
      }),
      parse: (result): ReviewResult => {
        const blocks = [...result.stdout.matchAll(/```json\s*([\s\S]*?)```/g)]
        const last = blocks.at(-1)?.[1]
        if (!last) throw new Error('review output has no ```json block')
        const output = JSON.parse(last) as Partial<ReviewResult>
        if (!Array.isArray(output.tasks)) {
          throw new Error('tasks must be an array')
        }
        if (typeof output.summary !== 'string') {
          throw new Error('summary must be a string')
        }
        return output as ReviewResult
      },
      timeoutMs: 16 * 60_000,
    }),
    // Blocked tasks leave the open list, so later runs and `fix-tasks` skip them until a human reopens them.
    judge: action({
      // IMPORTANT: a rerun may judge differently and block more tasks, so recovery must not rerun blindly.
      effect: manualEffect('judge.tsk-block'),
      run: async ({ outputs, signal }): Promise<JudgeResult> => {
        const tasks = outputs['list-open-tasks'] as OpenTask[]
        const result: JudgeResult = {
          agentTasks: [],
          blockedTasks: [],
          unjudgedTasks: [],
        }
        for (const task of tasks) {
          const id = `T${task.number}`
          try {
            const { stdout: details } = await execFileAsync(
              'tsk',
              ['list', id, '--json'],
              { signal, timeout: 30_000 },
            )
            const prompt = [
              `Decide whether an AI coding agent can complete tsk task ${id} without a human.`,
              'Task JSON:',
              details.trim(),
              'Answer "human" if it needs a product or design decision, credentials, access the agent lacks, or the task is too vague to act on.',
              'Otherwise answer "agent". Read code if needed. Do not change anything.',
              'Reply with only a fenced ```json block: { "verdict": "agent" | "human", "reason": "one sentence" }',
            ].join('\n')
            const { stdout } = await execFileAsync(
              'pi',
              ['-p', '--no-session', '--tools', 'read,grep,find,ls', prompt],
              { signal, timeout: 5 * 60_000, maxBuffer: 10_000_000 },
            )
            const block = [...stdout.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1]
            if (!block) throw new Error('judge output has no ```json block')
            const { verdict, reason } = verdictSchema.parse(JSON.parse(block))
            if (verdict === 'human') {
              await execFileAsync('tsk', ['status', id, 'blocked'], {
                signal,
                timeout: 30_000,
              })
              result.blockedTasks.push({ ...task, id, reason })
            } else {
              result.agentTasks.push({ ...task, id, reason })
            }
          } catch (error) {
            if (signal.aborted) throw error
            // An unjudged task stays open but unworked, because a failed judgement says nothing about whether it needs a human.
            result.unjudgedTasks.push({ ...task, id, reason: String(error).slice(-500) })
          }
        }
        return result
      },
      timeoutMs: 60 * 60_000,
    }),
  },
  edges: [
    { from: 'create-pr', to: 'adversarial-review' },
    { from: 'adversarial-review', to: 'list-open-tasks' },
    { from: 'list-open-tasks', to: 'judge' },
    { from: 'judge', to: 'fix-tasks' },
  ],
})
