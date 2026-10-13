import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod/v4'

import { openGitBookMcp } from '@/helpers/ai/gitbook-mcp'
import { repairMalformedToolName } from '@/helpers/ai/repair-tool-call'
import logger from '@/helpers/logger'
import { model } from '@/helpers/pair'
import type User from '@/models/user'
import {
  readFailedStep,
  updateFailedStepParameters,
} from '@/services/read-failed-step'

const GUIDE_HOST = 'guide.plumber.gov.sg'
const GUIDE_SEARCH_TOOL = 'searchDocumentation'
const GUIDE_URL_PATTERN = /https:\/\/guide\.plumber\.gov\.sg\/[^\s)\]>"']+/g
const MAX_SOURCES = 3
const MAX_SUMMARY_LENGTH = 1000

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

const sourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((url) => isGuideUrl(url)),
})

export const stepErrorFixResponseSchema = z.object({
  fixed: z.boolean(),
  summary: z.string().trim().min(1).max(MAX_SUMMARY_LENGTH),
  sources: z.array(sourceSchema).max(MAX_SOURCES),
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
After an update, briefly state which fields changed.
Otherwise, briefly state why no automatic fix was applied.
Do not repeat values marked [redacted].
Do not ask the user to paste secrets, tokens, or request headers.`

function isGuideUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === GUIDE_HOST
  } catch {
    return false
  }
}

function titleFromGuideUrl(url: string): string {
  const segment = new URL(url).pathname.split('/').filter(Boolean).pop()
  if (!segment) {
    return 'Plumber guide'
  }
  const title = decodeURIComponent(segment).replace(/[-_]/g, ' ')
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function collectGuideLinks(
  value: unknown,
): StepErrorFixResponse['sources'] {
  const urls = new Set<string>()

  const visit = (current: unknown) => {
    if (typeof current === 'string') {
      for (const match of current.matchAll(GUIDE_URL_PATTERN)) {
        const url = match[0].replace(/[.,]+$/, '')
        if (isGuideUrl(url)) {
          urls.add(url)
        }
      }
      return
    }
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (current && typeof current === 'object') {
      Object.values(current).forEach(visit)
    }
  }

  visit(value)

  return [...urls].slice(0, MAX_SOURCES).map((url) => ({
    title: titleFromGuideUrl(url).slice(0, 200),
    url,
  }))
}

export function sanitizeGuideAnswer(
  answer: string,
  sources: StepErrorFixResponse['sources'],
): string {
  const allowed = new Set(sources.map((source) => source.url))
  const withoutForeignLinks = answer.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, label: string, href: string) => {
      if (allowed.has(href) || isGuideUrl(href)) {
        return match
      }
      return label
    },
  )
  const withoutForeignUrls = withoutForeignLinks.replace(
    /https?:\/\/[^\s)\]>"']+/g,
    (url) => (isGuideUrl(url.replace(/[.,]+$/, '')) ? url : ''),
  )
  return withoutForeignUrls
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY_LENGTH)
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
  let gitbook: Awaited<ReturnType<typeof openGitBookMcp>> | null = null
  let appliedFixSummary: string | null = null

  try {
    gitbook = await openGitBookMcp({
      source: 'gitbook',
      traceId: meta.traceId,
      userId: meta.user.email,
    })
    if (!Object.hasOwn(gitbook.tools, GUIDE_SEARCH_TOOL)) {
      throw new GuideUnavailableError()
    }

    const tools = {
      ...gitbook.tools,
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
            .describe('One sentence naming the fields changed and why'),
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
    }

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      tools: tools as Parameters<typeof generateText>[0]['tools'],
      toolChoice: 'auto',
      stopWhen: stepCountIs(7),
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
        if (appliedFixSummary) {
          return { toolChoice: 'none' }
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

    const sources = collectGuideLinks({
      text: result.text,
      steps: result.steps,
    })
    const summary = sanitizeGuideAnswer(
      result.text ||
        appliedFixSummary ||
        'AI could not find a safe automatic fix for this step.',
      sources,
    )
    const parsed = stepErrorFixResponseSchema.safeParse({
      fixed: Boolean(appliedFixSummary),
      summary,
      sources,
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
    if (!gitbook) {
      logger.error('Failed to connect to GitBook MCP server', {
        event: 'step-error-fix-gitbook-failed',
        traceId: meta.traceId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new GuideUnavailableError()
    }
    throw error
  } finally {
    await gitbook?.close()
  }
}
