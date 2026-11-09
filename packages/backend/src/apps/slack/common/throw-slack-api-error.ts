import { StepErrorKind } from '@plumber/types'
import { z } from 'zod'

import StepError from '@/errors/step'

interface SlackErrorGroup {
  codes: string[]
  kind: StepErrorKind
  name: (code: string) => string
  solution: string
}

const SLACK_ERROR_GROUPS: SlackErrorGroup[] = [
  {
    codes: [
      'account_inactive',
      'invalid_auth',
      'token_revoked',
      'token_expired',
      'not_authed',
      'team_access_not_granted',
    ],
    kind: 'config',
    name: (code) => `Slack connection is no longer valid (${code})`,
    solution: 'Reconnect your Slack account, then try again.',
  },
  {
    codes: [
      'channel_not_found',
      'not_in_channel',
      'is_archived',
      'restricted_action',
      'no_permission',
    ],
    kind: 'config',
    name: (code) => `Slack denied access to the channel (${code})`,
    solution:
      'Check that the channel exists and is not archived, and that your Slack account can post in it.',
  },
  {
    codes: ['msg_too_long', 'no_text'],
    kind: 'config',
    name: (code) => `Invalid Slack message (${code})`,
    solution:
      "Check that the message is not empty and within Slack's length limit. Error could also result from the variables used in the message.",
  },
  {
    codes: [
      'fatal_error',
      'internal_error',
      'service_unavailable',
      'request_timeout',
    ],
    kind: 'third-party',
    name: (code) => `Slack is temporarily unavailable (${code})`,
    solution: 'Try again later.',
  },
]

const UNKNOWN_ERROR_GROUP: SlackErrorGroup = {
  codes: [],
  kind: 'internal',
  name: (code) => `Slack request failed (${code})`,
  solution: 'Please contact plumber@open.gov.sg for assistance.',
}

const slackErrorResponseSchema = z.object({ error: z.string() })

/**
 * Slack reports API failures as HTTP 200 with `ok: false`, so the error code is the only signal.
 */
export function throwSlackApiError(responseData: unknown): never {
  const code =
    slackErrorResponseSchema.safeParse(responseData).data?.error ??
    'unknown_error'
  const group =
    SLACK_ERROR_GROUPS.find(({ codes }) => codes.includes(code)) ??
    UNKNOWN_ERROR_GROUP

  throw new StepError({
    name: group.name(code),
    solution: group.solution,
    kind: group.kind,
  })
}
