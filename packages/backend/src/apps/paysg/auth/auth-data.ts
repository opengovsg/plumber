import { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

const authDataSchema = z.object({
  screenName: screenNameSchema,
  apiKey: z.string().trim().min(1, 'Invalid PaySG API key').max(150),
  paymentServiceId: z
    .string()
    .trim()
    .min(1, 'Invalid Payment Service ID')
    .max(150),
})

export type AuthData = z.infer<typeof authDataSchema>

export function validateAuthData($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}
