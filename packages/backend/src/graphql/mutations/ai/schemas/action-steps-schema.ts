import z from 'zod'

import {
  validateActionParameters,
  validateActionStepsRules,
} from './actions.zod'
import { generateSchema } from './schema-generator'

// Generate schema to validate action steps against the available actions in apps
// This schema is used by createFlowWithSteps where description/config are optional
const baseActionStepSchema = z.object({
  type: z.literal('action'),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
})

export function getActionStepsSchema(restrictedAppKeys: string[] = []) {
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
    .superRefine(validateActionStepsRules)
}

export const actionStepsSchema = getActionStepsSchema()
