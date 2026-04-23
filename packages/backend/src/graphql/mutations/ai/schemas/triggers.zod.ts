import { z } from 'zod/v3'

import { generateSchema } from './schema-generator'

// Base trigger schema with common properties
const baseTriggerSchema = z.object({
  description: z.string().describe('This is a trigger that starts the flow'),
  type: z.literal('trigger'),
})

export function getTriggerSchema(restrictedAppKeys: string[] = []) {
  return generateSchema(baseTriggerSchema, 'trigger', restrictedAppKeys)
}
