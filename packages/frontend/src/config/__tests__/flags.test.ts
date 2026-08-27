import { describe, expect, it, vi } from 'vitest'

import { getInputFlag, isInputFlagVisible } from '../flags'

describe('isInputFlagVisible', () => {
  const attachmentFlag = getInputFlag('updateCase', 'attachmentUpdates')

  it('shows inputs when the input flag is not configured', () => {
    const getFlagValue = vi.fn().mockReturnValue(null)
    expect(
      isInputFlagVisible('updateCase', 'attachmentUpdates', 1000, getFlagValue),
    ).toBe(true)
    expect(getFlagValue).toHaveBeenCalledWith(attachmentFlag, null)
  })

  it('hides inputs when the input flag is boolean false (beta off)', () => {
    const getFlagValue = vi.fn().mockReturnValue(false)
    expect(
      isInputFlagVisible('updateCase', 'attachmentUpdates', 1000, getFlagValue),
    ).toBe(false)
  })

  it('shows inputs when the input flag is boolean true (beta on)', () => {
    const getFlagValue = vi.fn().mockReturnValue(true)
    expect(
      isInputFlagVisible('updateCase', 'attachmentUpdates', 1000, getFlagValue),
    ).toBe(true)
  })

  it('shows inputs created on or before a timestamp flag value', () => {
    const getFlagValue = vi.fn().mockReturnValue(1000)
    expect(isInputFlagVisible('updateCase', 'caseUuid', 999, getFlagValue)).toBe(
      true,
    )
    expect(isInputFlagVisible('updateCase', 'caseUuid', 1000, getFlagValue)).toBe(
      true,
    )
    expect(isInputFlagVisible('updateCase', 'caseUuid', 1001, getFlagValue)).toBe(
      false,
    )
  })

  it('shows inputs when a timestamp flag is a numeric string', () => {
    const getFlagValue = vi.fn().mockReturnValue('1000')
    expect(isInputFlagVisible('updateCase', 'caseUuid', 999, getFlagValue)).toBe(
      true,
    )
    expect(isInputFlagVisible('updateCase', 'caseUuid', 1001, getFlagValue)).toBe(
      false,
    )
  })
})
