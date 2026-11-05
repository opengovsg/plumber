import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'

import {
  assertSlackFindMessageCreatable,
  SLACK_FIND_MESSAGE_DENIED,
} from './slack-find-message-access'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

describe('assertSlackFindMessageCreatable', () => {
  beforeEach(() => {
    mocks.getLdFlagValue.mockReset()
  })

  it('allows other actions without reading the flag', async () => {
    await assertSlackFindMessageCreatable({
      email: 'ada@example.com',
      appKey: 'slack',
      actionKey: 'sendMessageToChannel',
    })

    expect(mocks.getLdFlagValue).not.toHaveBeenCalled()
  })

  it('rejects a new Find a message step when the flag is false', async () => {
    mocks.getLdFlagValue.mockResolvedValue(false)

    await expect(
      assertSlackFindMessageCreatable({
        email: 'ada@example.com',
        appKey: 'slack',
        actionKey: 'findMessage',
      }),
    ).rejects.toThrow(BadUserInputError)

    await expect(
      assertSlackFindMessageCreatable({
        email: 'ada@example.com',
        appKey: 'slack',
        actionKey: 'findMessage',
      }),
    ).rejects.toThrow(SLACK_FIND_MESSAGE_DENIED)

    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      'app_slack_action_findMessage',
      'ada@example.com',
      false,
    )
  })

  it('allows a new Find a message step when the flag is true', async () => {
    mocks.getLdFlagValue.mockResolvedValue(true)

    await assertSlackFindMessageCreatable({
      email: 'ada@example.com',
      appKey: 'slack',
      actionKey: 'findMessage',
    })
  })

  it('allows a save on a step that is already Find a message', async () => {
    await assertSlackFindMessageCreatable({
      email: 'ada@example.com',
      appKey: 'slack',
      actionKey: 'findMessage',
      existingAppKey: 'slack',
      existingActionKey: 'findMessage',
    })

    expect(mocks.getLdFlagValue).not.toHaveBeenCalled()
  })
})
