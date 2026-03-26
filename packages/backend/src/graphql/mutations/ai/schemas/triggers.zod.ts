import { z } from 'zod/v3'

import { generateSchema } from './schema-generator'

// Base trigger schema with common properties
const baseTriggerSchema = z.object({
  description: z.string().describe('This is a trigger that starts the flow'),
  type: z.literal('trigger'),
})

export const TRIGGER_SCHEMA = generateSchema(baseTriggerSchema, 'trigger')

// Type inference for TypeScript
export type Trigger = z.infer<typeof TRIGGER_SCHEMA>

// Example usage with generateObject from the ai package:
/*
import { generateObject } from 'ai'
import { TRIGGER_SCHEMA } from './triggers.zod'

const result = await generateObject({
  model: yourModel,
  schema: TRIGGER_SCHEMA,
  prompt: "Generate a trigger for...",
})
*/
