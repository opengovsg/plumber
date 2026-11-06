import type { IGlobalVariable } from '@plumber/types'
import { z } from 'zod'

const authDataSchema = z.object({
  apiKey: z.string().trim().min(1, 'Empty API key').max(150),
})

export type AuthData = z.infer<typeof authDataSchema>

export function validateAuthData($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}
