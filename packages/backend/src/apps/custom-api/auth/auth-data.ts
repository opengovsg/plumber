import { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

const authDataSchema = z.object({
  label: screenNameSchema,
  headers: z.string(),
})

export type AuthData = z.infer<typeof authDataSchema>

export function validateAuthData($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}
