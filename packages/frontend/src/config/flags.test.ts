import { describe, expect, it } from 'vitest'

import {
  getAppActionFlag,
  getAppActionFlagFallback,
  SLACK_FIND_MESSAGE_FLAG,
} from './flags'

describe('slack find message flag', () => {
  it('uses the shared LaunchDarkly key', () => {
    expect(getAppActionFlag('slack', 'findMessage')).toBe(
      SLACK_FIND_MESSAGE_FLAG,
    )
    expect(SLACK_FIND_MESSAGE_FLAG).toBe('app_slack_action_findMessage')
  })

  it('hides Find a message until the flag allows it', () => {
    expect(getAppActionFlagFallback('slack', 'findMessage')).toBe(false)
    expect(getAppActionFlagFallback('slack', 'sendMessageToChannel')).toBe(
      true,
    )
  })
})
