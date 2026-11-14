import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod/v4'

import {
  closeQuietly,
  connectGitbookMcp,
  type GitbookMcpClient,
} from '@/helpers/ai/connect-gitbook-mcp'
import { repairMalformedToolName } from '@/helpers/ai/repair-tool-call'
import logger from '@/helpers/logger'
import { wrapMcpToolsWithUsageLogs } from '@/helpers/mcp-tool-usage-log'
import { model } from '@/helpers/pair'
import type User from '@/models/user'
import { listColumnsService } from '@/services/mcp/list-columns'
import {
  readFailedStep,
  replaceParameterKeysWithLabels,
  updateFailedStepParameters,
} from '@/services/read-failed-step'

const GUIDE_SEARCH_TOOL = 'searchDocumentation'

export const stepErrorFixRequestSchema = z.object({
  stepId: z.uuid(),
  appName: z.string().trim().min(1).max(100),
  appKey: z.string().trim().min(1).max(80),
  stepKey: z.string().trim().min(1).max(80),
  stepName: z.string().trim().min(1).max(120),
  errorName: z.string().trim().min(1).max(200),
  errorSolution: z.string().trim().max(2000).optional(),
})

export type StepErrorFixRequest = z.infer<typeof stepErrorFixRequestSchema>

export const stepErrorFixResponseSchema = z.object({
  fixed: z.boolean(),
  summary: z.string().trim().min(1),
})

export type StepErrorFixResponse = z.infer<typeof stepErrorFixResponseSchema>

export class GuideUnavailableError extends Error {
  constructor() {
    super('The Plumber guide is unavailable. Please try again.')
    this.name = 'GuideUnavailableError'
  }
}

const SYSTEM_PROMPT = `You fix a failed Plumber Check step.
Call get_step first. It returns the saved fields from that check.
Then search the Plumber guide.
Compare the saved field values with the guide and name the field that is wrong.
Call update_step_parameters only when the guide supports a safe parameter change.
Send only changed top-level parameters. Send the full nested value for each changed parameter.
Never change the connection.
Use only what the guide and get_step say.
If the guide does not support a safe fix, do not update the step.
If get_step returns an error, say you could not read the step settings.
If the saved columns are ids that no longer match, call list_columns and use the column names.
Never include an id, UUID, tile id, or parameter key in the user sentence.
If you cannot update the step, call explain_result with one plain sentence.
After an update, the update summary is one plain sentence. Name the wrong value and the correct value.
Do not quote the step configuration. Do not mention the guide. Do not say to check the step again.
If no update is made, use one plain sentence to say why.
Values marked [REDACTED] or [TRUNCATED] are hidden. Do not repeat or update them.
Do not ask the user to paste secrets, tokens, or request headers.`

export function toUserSentence(summary: string): string {
  const plain = summary
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '',
    )
    .replace(/[*_`#[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const first = plain.split(/(?<=[.!?])\s/)[0] ?? plain
  return first
    .replace(/[.?!]+$/, '')
    .trim()
    .slice(0, 220)
}

function buildPrompt(input: StepErrorFixRequest): string {
  const lines = [
    `App: ${input.appName} (${input.appKey})`,
    `Step: ${input.stepName} (${input.stepKey})`,
    `Error: ${input.errorName}`,
  ]
  if (input.errorSolution) {
    lines.push(`Existing guidance: ${input.errorSolution}`)
  }
  return lines.join('\n')
}

export async function fixStepError(
  input: StepErrorFixRequest,
  meta: { traceId: string; user: User },
): Promise<StepErrorFixResponse> {
  let gitbookClient: GitbookMcpClient | null = null
  let appliedFixSummary: string | null = null
  let explanation: string | null = null

  try {
    const gitbook = await connectGitbookMcp()
    gitbookClient = gitbook.client
    if (!Object.hasOwn(gitbook.tools, GUIDE_SEARCH_TOOL)) {
      throw new GuideUnavailableError()
    }

    const tools = {
      ...wrapMcpToolsWithUsageLogs(gitbook.tools, {
        source: 'gitbook',
        traceId: meta.traceId,
        userId: meta.user.email,
      }),
      get_step: tool({
        description:
          'Read the saved configuration of the step that failed Check step. Use the field labels and values to name the specific setting that is wrong.',
        inputSchema: z.object({}),
        execute: () =>
          readFailedStep(meta.user, input.stepId, {
            appKey: input.appKey,
            stepKey: input.stepKey,
          }),
      }),
      update_step_parameters: tool({
        description:
          'Update parameters on this failed step. The step and pipe are fixed by the server. Pass only changed top-level parameters and the full nested value for each changed parameter.',
        inputSchema: z.object({
          parameters: z.record(z.string(), z.unknown()),
          summary: z
            .string()
            .trim()
            .min(1)
            .max(300)
            .describe(
              'One plain sentence using the field label, never the parameter key. Name the wrong value and the correct value. Example: The email addresses are separated by semicolons (;), the correct separator is commas (,).',
            ),
        }),
        execute: async ({
          parameters,
          summary,
        }: {
          parameters: Record<string, unknown>
          summary: string
        }) => {
          if (appliedFixSummary) {
            return { error: 'This step was already updated.' }
          }
          const result = await updateFailedStepParameters(
            meta.user,
            input.stepId,
            { appKey: input.appKey, stepKey: input.stepKey },
            parameters,
            meta.traceId,
          )
          if ('error' in result) {
            return result
          }
          appliedFixSummary = summary
          return { updated: true }
        },
      }),
      list_columns: tool({
        description:
          'List the human-readable column names for this step. Use the names in the user sentence. Do not mention column ids.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const columns = await listColumnsService({
              user: meta.user,
              stepId: input.stepId,
            })
            return {
              columnNames: columns.columns.map((column) => column.name),
              truncated: columns.truncated,
            }
          } catch (error) {
            return {
              error:
                error instanceof Error
                  ? error.message
                  : 'Columns could not be listed.',
            }
          }
        },
      }),
      explain_result: tool({
        description:
          'Record the one sentence shown to the user when the step is not updated. Use field labels and column names. Do not include ids.',
        inputSchema: z.object({
          summary: z.string().trim().min(1).max(220),
        }),
        execute: async ({ summary }: { summary: string }) => {
          explanation = summary
          return { accepted: true }
        },
      }),
    }

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      tools: tools as Parameters<typeof generateText>[0]['tools'],
      toolChoice: 'auto',
      stopWhen: [
        stepCountIs(6),
        () => Boolean(appliedFixSummary || explanation),
      ],
      maxOutputTokens: 400,
      prepareStep: ({ stepNumber }) => {
        if (stepNumber === 0) {
          return { toolChoice: { type: 'tool', toolName: 'get_step' } }
        }
        if (stepNumber === 1) {
          return {
            toolChoice: {
              type: 'tool',
              toolName: GUIDE_SEARCH_TOOL,
            },
          }
        }
        if (stepNumber >= 4 && !appliedFixSummary && !explanation) {
          return { toolChoice: { type: 'tool', toolName: 'explain_result' } }
        }
        return { toolChoice: 'auto' }
      },
      experimental_repairToolCall: repairMalformedToolName,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'step-error-fix',
        metadata: {
          appKey: input.appKey,
          stepKey: input.stepKey,
          userId: meta.user.email,
        },
      },
    })

    const summary = toUserSentence(
      replaceParameterKeysWithLabels(
        appliedFixSummary ||
          explanation ||
          result.text ||
          'AI could not find a safe automatic fix for this step.',
        input.appKey,
        input.stepKey,
      ),
    )
    const parsed = stepErrorFixResponseSchema.safeParse({
      fixed: Boolean(appliedFixSummary),
      summary,
    })
    if (!parsed.success) {
      logger.error('Step error fix returned an unusable summary', {
        event: 'step-error-fix-empty',
        traceId: meta.traceId,
        appKey: input.appKey,
        stepKey: input.stepKey,
      })
      throw new Error('Step error fix returned an empty summary')
    }
    return parsed.data
  } catch (error) {
    if (error instanceof GuideUnavailableError) {
      throw error
    }
    if (!gitbookClient) {
      logger.error('Failed to connect to GitBook MCP server', {
        event: 'step-error-fix-gitbook-failed',
        traceId: meta.traceId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new GuideUnavailableError()
    }
    throw error
  } finally {
    if (gitbookClient) {
      closeQuietly(gitbookClient)
    }
  }
}
