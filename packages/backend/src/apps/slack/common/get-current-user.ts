import type { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

const slackUserSchema = z.object({
  id: z.string(),
  real_name: z.string().optional(),
  name: z.string().optional(),
})

const usersInfoResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    user: slackUserSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.string().optional(),
  }),
])

export type SlackUser = z.infer<typeof slackUserSchema>

const getCurrentUser = async ($: IGlobalVariable): Promise<SlackUser> => {
  const params = {
    user: $.auth.data.userId as string,
  }
  const response = await $.http.get('/users.info', { params })
  const parsed = usersInfoResponseSchema.safeParse(response.data)

  if (!parsed.success || parsed.data.ok === false) {
    const slackError =
      parsed.success && parsed.data.ok === false
        ? parsed.data.error
        : 'unexpected_response'
    throw new Error(
      `Error occurred while fetching Slack user: ${
        slackError ?? 'unknown_error'
      }. Ensure your Slack app has the users:read user token scope. (More info: https://api.slack.com/methods/users.info#errors)`,
    )
  }

  return parsed.data.user
}

export default getCurrentUser
