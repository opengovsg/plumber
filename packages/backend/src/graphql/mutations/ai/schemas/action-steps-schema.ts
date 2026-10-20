import z from 'zod'

import {
  validateActionParameters,
  validateActionStepsRules,
  validateBlockRules,
} from './actions.zod'
import { generateSchema } from './schema-generator'

// Generate schema to validate action steps against the available actions in apps
// This schema is used by createFlowWithSteps where description/config are optional
const baseActionStepSchema = z.object({
  type: z.literal('action'),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
})

// Pass `checkExecutionPath: false` when the list merges separate execution
// paths, then check each path with `validateExecutionPathRules`.
export function getActionStepsSchema(
  restrictedAppKeys: string[] = [],
  { checkExecutionPath = true }: { checkExecutionPath?: boolean } = {},
) {
  const actionStepSchema = generateSchema(
    baseActionStepSchema,
    'action',
    restrictedAppKeys,
  ).refine(validateActionParameters, {
    message:
      'If-then steps must have parameters with depth: 0 and branchName (string)',
  })

  return z
    .array(actionStepSchema)
    .min(1)
    .max(29) // max of 30 steps including trigger
    .superRefine(
      checkExecutionPath ? validateActionStepsRules : validateBlockRules,
    )
}

export const actionStepsSchema = getActionStepsSchema()
