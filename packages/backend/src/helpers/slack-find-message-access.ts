import { SLACK_FIND_MESSAGE_FLAG } from '@/config/flags'
import { BadUserInputError } from '@/errors/graphql-errors'
import { getLdFlagValue } from '@/helpers/launch-darkly'

export const SLACK_FIND_MESSAGE_DENIED =
  'Find a message can no longer be added.'

export function isSlackFindMessageAction(
  appKey?: string | null,
  actionKey?: string | null,
): boolean {
  return appKey === 'slack' && actionKey === 'findMessage'
}

/**
 * Blocks a new Find a message row unless the flag allows this user.
 * A row that is already Find a message can still be saved.
 */
export async function assertSlackFindMessageCreatable(input: {
  email?: string | null
  appKey?: string | null
  actionKey?: string | null
  existingAppKey?: string | null
  existingActionKey?: string | null
}): Promise<void> {
  if (!isSlackFindMessageAction(input.appKey, input.actionKey)) {
    return
  }

  if (isSlackFindMessageAction(input.existingAppKey, input.existingActionKey)) {
    return
  }

  const allowed = await getLdFlagValue(
    SLACK_FIND_MESSAGE_FLAG,
    input.email ?? null,
    false,
  )

  if (!allowed) {
    throw new BadUserInputError(SLACK_FIND_MESSAGE_DENIED)
  }
}
