import { z } from 'zod'

import { generateSchema } from './schema-generator'

// Base trigger schema with common properties
const baseTriggerSchema = z.object({
  description: z.string().describe('This is a trigger that starts the flow'),
  type: z.literal('trigger'),
  // Only an MRF proposal sets it, so the trigger shows the form's stage name.
  config: z.object({ stepName: z.string().min(1).max(64) }).optional(),
})

export function getTriggerSchema(restrictedAppKeys: string[] = []) {
  return generateSchema(baseTriggerSchema, 'trigger', restrictedAppKeys)
}
