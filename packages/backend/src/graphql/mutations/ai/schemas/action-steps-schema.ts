import z from 'zod/v3'

import {
  validateActionParameters,
  validateActionStepsRules,
} from './actions.zod'
import { generateSchema } from './schema-generator'

// Generate schema to validate action steps against the available actions in apps
const actionStepSchema = generateSchema(
  z.object({ type: z.literal('action') }),
  'action',
).refine(validateActionParameters, {
  message:
    'If-then steps must have parameters with depth: 0 and branchName (string)',
})

export const actionStepsSchema = z
  .array(actionStepSchema)
  .min(1)
  .superRefine(validateActionStepsRules)
