import z from 'zod/v3'

import {
  validateActionParameters,
  validateActionStepsRules,
} from './actions.zod'
import { generateSchema } from './schema-generator'

// Generate schema to validate action steps against the available actions in apps
// This schema is used by createFlowWithSteps where description/config are optional
const actionStepSchema = generateSchema(
  z.object({
    type: z.literal('action'),
    description: z.string().optional(),
    config: z.record(z.any()).optional(),
  }),
  'action',
).refine(validateActionParameters, {
  message:
    'If-then steps must have parameters with depth: 0 and branchName (string)',
})

export const actionStepsSchema = z
  .array(actionStepSchema)
  .min(1)
  .superRefine(validateActionStepsRules)
