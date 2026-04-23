import { z } from 'zod/v3' // NOTE: we use zod/v3 to avoid the "Type instantiation is excessively deep and possibly infinite" error

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
})

export const ifThenParametersSchema = z.object({
  depth: z.literal(0).default(0),
  branchName: z.string().default('Branch'),
})

function getActionSchema(restrictedAppKeys: string[] = []) {
  const generatedSchema = generateSchema(
    baseActionSchema,
    'action',
    restrictedAppKeys,
  )

  return generatedSchema.refine(validateActionParameters, {
    message:
      'Parameters are only allowed when key is ifThen (with depth: 0 and branchName)',
  })
}

export function getActionsSchema(restrictedAppKeys: string[] = []) {
  return z
    .array(getActionSchema(restrictedAppKeys))
    .min(1)
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
 * 2. For-each cannot be anywhere after if-then
 * 3. If-then must have action after it (no consecutive if-then)
 * 4. Delay cannot be after for-each
 */
export function validateActionStepsRules(steps: any[], ctx: z.RefinementCtx) {
  let forEachCount = 0
  let lastForEachIndex = -1
  let hasSeenIfThen = false

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const nextStep = i < steps.length - 1 ? steps[i + 1] : null

    const isIfThen =
      step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IF_THEN

    // Count for-each actions and track last position
    if (
      step.appKey === TOOLBOX_APP_KEY &&
      step.key === TOOLBOX_ACTIONS.FOR_EACH
    ) {
      forEachCount++
      lastForEachIndex = i

      // Rule: Only 1 for-each per pipe
      if (forEachCount > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'There can only be 1 for-each action in each pipe',
          path: [i],
        })
      }

      // Rule: for-each cannot be anywhere after any if-then
      if (hasSeenIfThen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'For-each action cannot be placed after an if-then action',
          path: [i],
        })
      }
    }

    // Track if we've seen any if-then action
    if (isIfThen) {
      hasSeenIfThen = true

      // Rule: if-then must have a non-if-then action after it (no consecutive if-then actions)
      const nextIsIfThen =
        nextStep?.appKey === TOOLBOX_APP_KEY &&
        nextStep?.key === TOOLBOX_ACTIONS.IF_THEN

      if (!nextStep) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'If-then actions must have another action immediately after them',
          path: [i],
        })
      } else if (nextIsIfThen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'If-then actions cannot be consecutive - must alternate with non-if-then actions',
          path: [i],
        })
      }
    }

    // Rule: delay action cannot be after for-each
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
