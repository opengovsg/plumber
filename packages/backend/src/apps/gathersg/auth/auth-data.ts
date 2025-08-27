import { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

const authDataSchema = z.object({
  screenName: z.string().min(1, 'Empty screen name'),
  apiKey: z.string().min(1, 'Empty API key'),
})

export type AuthData = z.infer<typeof authDataSchema>

export function validateAuthData($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}
