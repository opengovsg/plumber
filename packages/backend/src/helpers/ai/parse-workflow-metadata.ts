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

export const WORKFLOW_METADATA_MARKER = '<!-- WORKFLOW_METADATA'
export const WORKFLOW_METADATA_REGEX =
  /<!--\s*WORKFLOW_METADATA\s*([\s\S]*?)-->/

export type WorkflowData = ReturnType<typeof parseWorkflowMetadata>

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

function isIfThenMetadataStep(step: any): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.IF_THEN
  )
}

/**
 * Flattens the `steps` nested under an if-then, recording the block's extent
 * as `ifThenChildCount`. A nested if-then is kept so the schema rules reject
 * it and name the offending step.
 */
export function flattenWorkflowMetadataSteps(rawSteps: any[]): any[] {
  const flattened: any[] = []
  for (const rawStep of rawSteps) {
    if (!rawStep || typeof rawStep !== 'object') {
      flattened.push(rawStep)
      continue
    }
    const { steps: nestedSteps, ...step } = rawStep
    if (!isIfThenMetadataStep(step) || !Array.isArray(nestedSteps)) {
      flattened.push(step)
      continue
    }
    const children = flattenWorkflowMetadataSteps(nestedSteps)
    flattened.push(
      children.length > 0
        ? { ...step, ifThenChildCount: children.length }
        : step,
      ...children,
    )
  }
  return flattened
}

function parseRawWorkflowData(text: string): IFlowSteps {
  const match = text.match(WORKFLOW_METADATA_REGEX)
  if (!match) {
    throw new BadUserInputError('Unable to generate the workflow.')
  }

  let parsed: any
  try {
    parsed = parseYaml(match[1].trim())
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

  const [firstStep, ...remainingSteps] = flattenWorkflowMetadataSteps(
    parsed.steps,
  )

  return {
    name: String(parsed.name ?? 'Build with AI').slice(0, 64),
    trigger: {
      type: 'trigger' as const,
      appKey: firstStep.appKey,
      key: firstStep.key,
      description: String(firstStep.description ?? ''),
    },
    actions: remainingSteps.map((step: any) => {
      const isIfThen = isIfThenMetadataStep(step)

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
          ...(step.ifThenChildCount !== undefined && {
            ifThenChildCount: step.ifThenChildCount,
          }),
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
