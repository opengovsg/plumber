import z from 'zod'

import { screenNameSchema } from '@/helpers/app-auth-schema'

export const authDataSchema = z.object({
  screenName: screenNameSchema,
  campaignId: z.string().trim().max(50),
  apiKey: z.string().trim().max(50),
})

export type AuthData = z.infer<typeof authDataSchema>
