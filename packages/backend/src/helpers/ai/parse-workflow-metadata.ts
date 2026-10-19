import { IFlowSteps } from '@plumber/types'

import { parse as parseYaml } from 'yaml'
import z from 'zod'
import { fromZodError } from 'zod-validation-error'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { BadUserInputError } from '@/errors/graphql-errors'
import { getActionsSchema } from '@/graphql/mutations/ai/schemas/actions.zod'
import { getTriggerSchema } from '@/graphql/mutations/ai/schemas/triggers.zod'
import logger from '@/helpers/logger'

export const WORKFLOW_METADATA_MARKER = '<!-- WORKFLOW_METADATA'
export const WORKFLOW_METADATA_REGEX =
  /<!--\s*WORKFLOW_METADATA\s*([\s\S]*?)-->/

export type WorkflowData = ReturnType<typeof parseWorkflowMetadata>

const FREE_TEXT_KEYS = new Set([
  'name',
  'stepName',
  'description',
  'branchName',
])

function isQuoted(value: string): boolean {
  const quote = value[0]
  return (
    value.length >= 2 &&
    (quote === '"' || quote === "'") &&
    value.at(-1) === quote
  )
}

// The LLM emits unquoted free text, which YAML can misread as syntax (e.g. ": " or " #").
// This function is a stopgap to best-effort fix wrongly emitted YAML strings.
function quoteFreeTextValues(yamlText: string): string {
  return yamlText
    .split('\n')
    .map((line) => {
      // The key ends at the first ": ". Everything after it is the value.
      const separatorIndex = line.indexOf(': ')
      if (separatorIndex === -1) {
        return line
      }

      // Strip indentation and a leading "- " list marker from the key.
      const keyPart = line.slice(0, separatorIndex).trim()
      const key = keyPart.startsWith('- ') ? keyPart.slice(2).trim() : keyPart
      const value = line.slice(separatorIndex + 2).trim()

      // Skip other keys and quoted values. Empty values stay null so defaults like "Build with AI" apply.
      if (!FREE_TEXT_KEYS.has(key) || value === '' || isQuoted(value)) {
        return line
      }

      // Keep the line up to ": " and rewrite the value as a JSON string, which YAML reads as quoted text.
      return line.slice(0, separatorIndex + 2) + JSON.stringify(value)
    })
    .join('\n')
}

// Converts a ZodError into a user-facing message with workflow-specific context.
// - invalid_union: the appKey/key combo didn't match any known app, so we report
//   which step (trigger or action at step N) is invalid.
// - custom: emitted by validateActionStepsRules (if-then, for-each, delay
//   ordering rules); those messages are already human-readable, so pass through.
// - fallback: fromZodError for anything else (e.g. missing fields, array length).
function formatWorkflowError(
  error: z.ZodError,
  workflowData?: IFlowSteps,
): string {
  for (const issue of error.issues) {
    if (issue.code === z.ZodIssueCode.invalid_union) {
      const [field, index] = issue.path

      if (field === 'trigger' && workflowData) {
        return `Invalid trigger detected.`
      }

      if (field === 'actions' && typeof index === 'number' && workflowData) {
        // actions[0] is step 2 (step 1 is the trigger), so offset by 2
        const stepNum = index + 2
        return `Invalid action detected at step ${stepNum}.`
      }
    }

    if (issue.code === z.ZodIssueCode.custom && issue.message) {
      return `${issue.message}.`
    }
  }

  return fromZodError(error).message
}

function canParseYaml(yamlText: string): boolean {
  try {
    parseYaml(yamlText)
    return true
  } catch {
    return false
  }
}

function parseRawWorkflowData(text: string): IFlowSteps {
  const match = text.match(WORKFLOW_METADATA_REGEX)
  if (!match) {
    throw new BadUserInputError('Unable to generate the workflow.')
  }

  const rawYaml = match[1].trim()
  // Quoting rewrites most valid outputs too, so only a failed raw parse counts as an LLM error.
  if (!canParseYaml(rawYaml)) {
    logger.info('AI builder emitted invalid workflow YAML', {
      event: 'ai-builder-workflow-yaml-invalid',
    })
  }

  let parsed: any
  try {
    parsed = parseYaml(quoteFreeTextValues(rawYaml))
  } catch {
    throw new BadUserInputError('Unable to generate the workflow.')
  }

  if (
    !parsed?.steps ||
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0
  ) {
    throw new BadUserInputError('Unable to generate the workflow.')
  }

  const [firstStep, ...remainingSteps] = parsed.steps

  return {
    name: String(parsed.name ?? 'Build with AI').slice(0, 64),
    trigger: {
      type: 'trigger' as const,
      appKey: firstStep.appKey,
      key: firstStep.key,
      description: String(firstStep.description ?? ''),
    },
    actions: remainingSteps.map((step: any) => {
      const isIfThen =
        step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IF_THEN

      return {
        type: 'action' as const,
        appKey: step.appKey,
        key: step.key,
        // description → templateConfig.customTemplate: setup guide shown above the step (max 100 chars)
        description: String(step.description ?? '').slice(0, 100),
        config: {
          // stepName → step title label (max 64 chars); falls back to key if omitted
          stepName: String(step.stepName ?? step.key ?? '').slice(0, 64),
        },
        // if-then requires parameters with depth and branchName for branch labelling
        ...(isIfThen && {
          parameters: {
            depth: 0,
            branchName: String(step.branchName ?? 'Branch'),
          },
        }),
      }
    }),
  }
}

function parseWorkflowMetadata(
  text: string,
  restrictedAppKeys: string[] = [],
): IFlowSteps {
  const workflowData = parseRawWorkflowData(text)

  const schema = z.object({
    trigger: getTriggerSchema(restrictedAppKeys),
    actions: getActionsSchema(restrictedAppKeys),
    name: z.string().max(64).default('Build with AI'),
  })

  const result = schema.safeParse(workflowData)
  if (!result.success) {
    throw new BadUserInputError(formatWorkflowError(result.error, workflowData))
  }

  const flowSteps: IFlowSteps = {
    name: result.data.name,
    trigger: result.data.trigger,
    actions: result.data.actions.map((action) => ({
      ...action,
      config: { ...action.config, templateConfig: {} },
    })),
  }
  return flowSteps
}

export { parseWorkflowMetadata }
