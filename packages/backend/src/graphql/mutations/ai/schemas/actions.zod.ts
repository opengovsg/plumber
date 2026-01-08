import { z } from 'zod/v3' // NOTE: we use zod/v3 to avoid the "Type instantiation is excessively deep and possibly infinite" error

import { generateSchema } from './schema-generator'

// Base action schema with common properties
const baseActionSchema = z.object({
  description: z.string().describe('This is an action that performs a task'),
  type: z.literal('action'),
  config: z.object({
    stepName: z.string().min(1).max(64),
  }),
})

export const ACTION_SCHEMA = generateSchema(baseActionSchema, 'action')

// Type inference for TypeScript
export type Action = z.infer<typeof ACTION_SCHEMA>

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
