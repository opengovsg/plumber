import { z } from 'zod/v3' // NOTE: we use zod/v3 to avoid the "Type instantiation is excessively deep and possibly infinite" error

// Base action schema with common properties
const baseActionSchema = z.object({
  description: z.string().describe('This is an action that performs a task'),
  type: z.literal('action'),
  config: z.object({
    stepName: z.string().min(1).max(64),
  }),
  position: z.number().min(2).optional(),
})

// Custom API action schema
const customApiActionSchema = baseActionSchema.extend({
  appKey: z.literal('custom-api'),
  key: z.literal('httpRequest'),
})

// Delay action schema
const delayActionSchema = baseActionSchema.extend({
  appKey: z.literal('delay'),
  key: z.enum(['delayFor', 'delayUntil']),
})

// Formatter action schema
const formatterActionSchema = baseActionSchema.extend({
  appKey: z.literal('formatter'),
  key: z.enum(['addSubtractDateTime', 'convertDateTime']),
})

// Lettersg action schema
const lettersgActionSchema = baseActionSchema.extend({
  appKey: z.literal('lettersg'),
  key: z.literal('createLetter'),
})

// M365 Excel action schema
const m365ExcelActionSchema = baseActionSchema.extend({
  appKey: z.literal('m365-excel'),
  key: z.enum([
    'createTableRow',
    'getTableRow',
    'getTableRows',
    'updateTableRow',
  ]),
})

// Paysg action schema
const paysgActionSchema = baseActionSchema.extend({
  appKey: z.literal('paysg'),
  key: z.enum([
    'createPayment',
    'createPaymentFormSubmission',
    'createPaymentFormSubmissionSubscription',
    'getPayment',
    'sendEmail',
  ]),
})

// Postman action schema
const postmanActionSchema = baseActionSchema.extend({
  appKey: z.literal('postman'),
  key: z.literal('sendTransactionalEmail'),
})

// Postman SMS action schema
const postmanSmsActionSchema = baseActionSchema.extend({
  appKey: z.literal('postman-sms'),
  key: z.literal('sendSms'),
})

// Slack action schema
const slackActionSchema = baseActionSchema.extend({
  appKey: z.literal('slack'),
  key: z.enum(['findMessage', 'sendMessageToChannel']),
})

// Telegram Bot action schema
const telegramBotActionSchema = baseActionSchema.extend({
  appKey: z.literal('telegram-bot'),
  key: z.literal('sendMessage'),
})

// Tiles action schema
const tilesActionSchema = baseActionSchema.extend({
  appKey: z.literal('tiles'),
  key: z.enum([
    'createTileRow',
    'findSingleRow',
    'findMultipleRows',
    'updateSingleRow',
  ]),
})

// Toolbox action schema
const toolboxActionSchema = baseActionSchema.extend({
  appKey: z.literal('toolbox'),
  key: z.enum(['ifThen', 'forEach', 'onlyContinueIf']),
  parameters: z.object({
    depth: z.literal(0).optional(),
    branchName: z.string().optional().default('Branch'),
  }),
})

export const ACTION_SCHEMA = z.discriminatedUnion('appKey', [
  customApiActionSchema,
  delayActionSchema,
  formatterActionSchema,
  lettersgActionSchema,
  m365ExcelActionSchema,
  paysgActionSchema,
  postmanActionSchema,
  postmanSmsActionSchema,
  slackActionSchema,
  telegramBotActionSchema,
  tilesActionSchema,
  toolboxActionSchema,
])

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
