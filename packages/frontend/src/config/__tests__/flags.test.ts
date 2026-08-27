import { describe, expect, it, vi } from 'vitest'

import {
  GATHERSG_ATTACHMENT_UPDATES_FLAG,
  isBooleanGatedInputVisible,
} from '../flags'

describe('isBooleanGatedInputVisible', () => {
  it('returns true for inputs that are not boolean-gated', () => {
    const getFlagValue = vi.fn().mockReturnValue(false)
    expect(isBooleanGatedInputVisible('updateCase', 'caseUuid', getFlagValue)).toBe(
      true,
    )
    expect(getFlagValue).not.toHaveBeenCalled()
  })

  it('returns false for attachmentUpdates when the beta flag is off', () => {
    const getFlagValue = vi.fn().mockReturnValue(false)
    expect(
      isBooleanGatedInputVisible('updateCase', 'attachmentUpdates', getFlagValue),
    ).toBe(false)
    expect(getFlagValue).toHaveBeenCalledWith(
      GATHERSG_ATTACHMENT_UPDATES_FLAG,
      false,
    )
  })

  it('returns true for attachmentUpdates when the beta flag is on', () => {
    const getFlagValue = vi.fn().mockReturnValue(true)
    expect(
      isBooleanGatedInputVisible('updateCase', 'attachmentUpdates', getFlagValue),
    ).toBe(true)
  })
})
