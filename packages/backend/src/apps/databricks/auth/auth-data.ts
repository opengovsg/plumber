import { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

const databricksAuthDataSchema = z.object({
  screenName: screenNameSchema,
  token: z.string().min(1, 'Empty Personal Access Token').max(100),
})

export type DatabricksAuthData = z.infer<typeof databricksAuthDataSchema>

export function validateAuthData($: IGlobalVariable): DatabricksAuthData {
  return databricksAuthDataSchema.parse($.auth?.data)
}
