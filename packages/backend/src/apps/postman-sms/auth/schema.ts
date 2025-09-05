import z from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

export const authDataSchema = z.object({
  screenName: screenNameSchema,
  campaignId: z.string().trim(),
  apiKey: z.string().trim(),
})

export type AuthData = z.infer<typeof authDataSchema>
