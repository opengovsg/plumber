import { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

const databricksAuthDataSchema = z.object({
  screenName: screenNameSchema,
  schema: z
    .string()
    .min(1, 'Empty Schema Name')
    .regex(/^[a-z0-9_]+$/, {
      message:
        'Schema name can only contain lowercase letters, numbers and underscores',
    })
    .max(100),
  token: z.string().min(1, 'Empty Personal Access Token').max(100),
})

export type DatabricksAuthData = z.infer<typeof databricksAuthDataSchema>

export function validateAuthData($: IGlobalVariable): DatabricksAuthData {
  return databricksAuthDataSchema.parse($.auth?.data)
}
