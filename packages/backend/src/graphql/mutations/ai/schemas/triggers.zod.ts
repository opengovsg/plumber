import { z } from 'zod/v3'

// Base trigger schema with common properties
const baseTriggerSchema = z.object({
  position: z.number().default(1),
  type: z.literal('trigger'),
})

// FormSG trigger schema
const formsgTriggerSchema = baseTriggerSchema.extend({
  appKey: z.literal('formsg'),
  key: z.literal('newSubmission'),
  description: z
    .string()
    .describe(
      'This is a formsg trigger, which starts the workflow when a new submission is received',
    ),
})

// Scheduler trigger schema
const schedulerTriggerSchema = baseTriggerSchema.extend({
  appKey: z.literal('scheduler'),
  key: z.enum(['everyDay', 'everyHour', 'everyWeek']),
  description: z
    .string()
    .describe(
      'This is a scheduler trigger, which starts the workflow at a specified interval based on the event',
    ),
})

// Webhook trigger schema (note: webhook doesn't require description)
const webhookTriggerSchema = baseTriggerSchema.extend({
  appKey: z.literal('webhook'),
  key: z.literal('catchRawWebhook'),
  description: z
    .string()
    .optional()
    .describe(
      'This is a webhook trigger, which starts the workflow when a webhook is received',
    ),
})

export const TRIGGER_SCHEMA = z.discriminatedUnion('appKey', [
  formsgTriggerSchema,
  schedulerTriggerSchema,
  webhookTriggerSchema,
])

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
