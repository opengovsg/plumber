import { z } from 'zod'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'

import { generateSchema } from './schema-generator'

// Base action schema with common properties
const baseActionSchema = z.object({
  description: z.string().describe('This is an action that performs a task'),
  type: z.literal('action'),
  config: z.object({
    stepName: z.string().min(1).max(64),
  }),
  // Preview only. Marks an action that runs when an approval stage rejects.
  approvalBranch: z.literal('reject').optional(),
})

export const ifThenParametersSchema = z.object({
  depth: z.literal(0).default(0),
  branchName: z.string().default('Branch'),
})

/**
 * Number of steps inside an If block, when the caller lays blocks out
 * explicitly. Absent means the legacy derived extent: every step up to the
 * next if-then or the end of the pipe.
 */
export const ifThenChildCountSchema = z.number().int().min(1).optional()

interface LayoutStep {
  appKey?: string | null
  key?: string | null
  ifThenChildCount?: number
  isApproval?: boolean
  approvalBranch?: 'reject'
}

function isIfThenLayoutStep(step: LayoutStep | undefined): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.IF_THEN
  )
}

function isForEachLayoutStep(step: LayoutStep | undefined): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.FOR_EACH
  )
}

/**
 * Number of steps inside the If block that starts at `index`. An explicit
 * `ifThenChildCount` wins over the legacy derived extent.
 */
export function getIfThenChildCount(
  steps: LayoutStep[],
  index: number,
): number {
  const explicit = steps[index]?.ifThenChildCount
  if (explicit !== undefined) {
    return explicit
  }
  let count = 0
  for (let i = index + 1; i < steps.length; i++) {
    if (isIfThenLayoutStep(steps[i])) {
      break
    }
    count++
  }
  return count
}

function getActionSchema(
  restrictedAppKeys: string[] = [],
  options: { includeHidden?: boolean } = {},
) {
  const generatedSchema = generateSchema(
    baseActionSchema,
    'action',
    restrictedAppKeys,
    options,
  )

  return generatedSchema.refine(validateActionParameters, {
    message:
      'Parameters are only allowed when key is ifThen (with depth: 0 and branchName)',
  })
}

export function getActionsSchema(
  restrictedAppKeys: string[] = [],
  options: { includeHidden?: boolean } = {},
) {
  return z
    .array(getActionSchema(restrictedAppKeys, options))
    .min(1, 'At least one action step is required.')
    .max(29) // max of 30 steps including trigger
    .superRefine(validateActionStepsRules)
}

/**
 * Reusable validation function for individual action steps that enforces:
 * - If-then actions must have parameters with depth: 0 and branchName
 * - Other actions should not have parameters field (removes it if present)
 */
export function validateActionParameters(data: any): boolean {
  // IF-THEN special case: parameters are required to specify depth: 0 and branchName
  if (data.appKey === TOOLBOX_APP_KEY && data.key === TOOLBOX_ACTIONS.IF_THEN) {
    const result = ifThenParametersSchema.safeParse(data.parameters)
    return result.success
  }

  // For other keys, remove parameters
  delete data.parameters
  return data.parameters === undefined
}

/**
 * Reusable validation function for action steps that enforces:
 * 1. Only 1 for-each per pipe
 * 2. Every If block contains at least one step
 * 3. If blocks do not nest
 * 4. For-each cannot sit inside an If block
 * 5. Delay cannot be after for-each
 * 6. A rejected-path action follows an approval stage
 *
 * An If block's extent comes from `getIfThenChildCount`, so a legacy flat
 * list (no `ifThenChildCount`) still fails the old way: a for-each after an
 * if-then is inside that block, and back-to-back if-thens leave one empty.
 */
export function validateActionStepsRules(
  steps: LayoutStep[],
  ctx: z.RefinementCtx,
) {
  // The latest MRF stage entry decides whether a rejected-path action has an
  // approval stage to belong to.
  let lastStageIsApproval = false
  let forEachCount = 0
  let lastForEachIndex = -1
  // Index just past the If block being scanned, or -1 outside any block.
  let blockEndExclusive = -1

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const isInsideBlock = i < blockEndExclusive

    if (step.appKey === 'formsg' && step.key === 'mrfSubmission') {
      lastStageIsApproval = step.isApproval === true
    }

    if (step.approvalBranch === 'reject' && !lastStageIsApproval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'A rejected-path action must come after an approval stage of the form',
        path: [i],
      })
    }

    if (isIfThenLayoutStep(step)) {
      if (isInsideBlock) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'If blocks cannot be nested inside another If block',
          path: [i],
        })
      }

      const childCount = getIfThenChildCount(steps, i)
      if (childCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            i === steps.length - 1
              ? 'If-then actions must have another action immediately after them'
              : 'If-then actions cannot be consecutive - must alternate with non-if-then actions',
          path: [i],
        })
      } else if (i + childCount >= steps.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'If block extends past the last step of the pipe',
          path: [i],
        })
      }

      if (!isInsideBlock) {
        blockEndExclusive = i + 1 + childCount
      }
    }

    if (isForEachLayoutStep(step)) {
      forEachCount++
      lastForEachIndex = i

      if (forEachCount > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'There can only be 1 for-each action in each pipe',
          path: [i],
        })
      }

      if (isInsideBlock) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'For-each action cannot be placed inside an If block',
          path: [i],
        })
      }
    }

    if (step.appKey === 'delay' && lastForEachIndex >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Delay action cannot be added after a for-each step',
        path: [i],
      })
    }
  }
}

// Example usage with generateObject from the ai package:
/*
import { generateObject } from 'ai'
import { actionSchema } from './actions.zod'

const result = await generateObject({
  model: yourModel,
  schema: actionSchema,
  prompt: "Generate a list of actions for...",
})
*/
