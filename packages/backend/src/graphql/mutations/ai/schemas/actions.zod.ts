import { z } from 'zod/v3' // NOTE: we use zod/v3 to avoid the "Type instantiation is excessively deep and possibly infinite" error

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'

import { generateSchema } from './schema-generator'

// Base action schema with common properties
const baseActionSchema = z.object({
  description: z.string().describe('This is an action that performs a task'),
  type: z.literal('action'),
  config: z.object({
    stepName: z.string().min(1).max(64),
  }),
})

const generatedSchema = generateSchema(baseActionSchema, 'action')

export const ACTION_SCHEMA = generatedSchema.refine(
  (data) => {
    // IF-THEN special case: parameters are required to specify depth and branchName
    if (
      data.appKey === TOOLBOX_APP_KEY &&
      data.key === TOOLBOX_ACTIONS.IF_THEN
    ) {
      return data.parameters !== undefined
    }

    // For other keys, remove parameters
    delete data.parameters
    return data.parameters === undefined
  },
  {
    message: 'Parameters are only allowed when key is ifThen',
  },
)

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
