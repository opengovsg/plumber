import z from 'zod'

export const authDataSchema = z.object({
  screenName: z.string().trim(),
  campaignId: z.string().trim(),
  apiKey: z.string().trim(),
})

export type AuthData = z.infer<typeof authDataSchema>
