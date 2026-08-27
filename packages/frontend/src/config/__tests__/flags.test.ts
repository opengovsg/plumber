import { describe, expect, it, vi } from 'vitest'

import { getInputFlag, isInputFlagVisible } from '../flags'

describe('getInputFlag', () => {
  it('builds the NRIC filter flag key from the trigger and input keys', () => {
    expect(getInputFlag('newSubmission', 'nricFilter')).toBe(
      'input_newSubmission_nricFilter',
    )
  })

  it('builds the attachment updates flag key from the action and input keys', () => {
    expect(getInputFlag('updateCase', 'attachmentUpdates')).toBe(
      'input_updateCase_attachmentUpdates',
    )
  })
})

describe('isInputFlagVisible', () => {
  const NRIC_CUTOFF = 1_700_000_000_000
  const BEFORE_CUTOFF = NRIC_CUTOFF - 1
  const AFTER_CUTOFF = NRIC_CUTOFF + 1

  /**
   * Original FlowSubstep rule: `!flagValue || +step.createdAt <= flagValue`
   */
  const originalIsVisible = (flagValue: unknown, stepCreatedAt: number) =>
    !flagValue || stepCreatedAt <= Number(flagValue)

  it('looks up input_newSubmission_nricFilter', () => {
    const getFlagValue = vi.fn().mockReturnValue(null)
    isInputFlagVisible('newSubmission', 'nricFilter', BEFORE_CUTOFF, getFlagValue)
    expect(getFlagValue).toHaveBeenCalledWith(
      'input_newSubmission_nricFilter',
      null,
    )
  })

  it('matches the original timestamp rule for the NRIC filter', () => {
    const timestampFlag = vi.fn().mockReturnValue(NRIC_CUTOFF)

    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        BEFORE_CUTOFF,
        timestampFlag,
      ),
    ).toBe(true)
    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        NRIC_CUTOFF,
        timestampFlag,
      ),
    ).toBe(true)
    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        AFTER_CUTOFF,
        timestampFlag,
      ),
    ).toBe(false)

    expect(originalIsVisible(NRIC_CUTOFF, BEFORE_CUTOFF)).toBe(true)
    expect(originalIsVisible(NRIC_CUTOFF, AFTER_CUTOFF)).toBe(false)
  })

  it('shows the NRIC filter when the timestamp flag is off (0 or unset)', () => {
    expect(
      isInputFlagVisible('newSubmission', 'nricFilter', AFTER_CUTOFF, () => 0),
    ).toBe(true)
    expect(originalIsVisible(0, AFTER_CUTOFF)).toBe(true)

    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        AFTER_CUTOFF,
        () => null,
      ),
    ).toBe(true)
    expect(originalIsVisible(null, AFTER_CUTOFF)).toBe(true)
  })

  it('accepts a numeric-string timestamp the way LD may return it', () => {
    const getFlagValue = vi.fn().mockReturnValue(String(NRIC_CUTOFF))
    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        BEFORE_CUTOFF,
        getFlagValue,
      ),
    ).toBe(true)
    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        AFTER_CUTOFF,
        getFlagValue,
      ),
    ).toBe(false)
  })

  it('hides attachment updates when the boolean beta flag is off', () => {
    const getFlagValue = vi.fn().mockReturnValue(false)
    expect(
      isInputFlagVisible(
        'updateCase',
        'attachmentUpdates',
        BEFORE_CUTOFF,
        getFlagValue,
      ),
    ).toBe(false)
  })

  it('shows attachment updates when the boolean beta flag is on', () => {
    const getFlagValue = vi.fn().mockReturnValue(true)
    expect(
      isInputFlagVisible(
        'updateCase',
        'attachmentUpdates',
        BEFORE_CUTOFF,
        getFlagValue,
      ),
    ).toBe(true)
  })

  it('evaluates NRIC timestamp and attachment boolean flags independently', () => {
    const getFlagValue = vi.fn((flagKey: string) => {
      if (flagKey === 'input_newSubmission_nricFilter') {
        return NRIC_CUTOFF
      }
      if (flagKey === 'input_updateCase_attachmentUpdates') {
        return false
      }
      return null
    })

    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        BEFORE_CUTOFF,
        getFlagValue,
      ),
    ).toBe(true)
    expect(
      isInputFlagVisible(
        'newSubmission',
        'nricFilter',
        AFTER_CUTOFF,
        getFlagValue,
      ),
    ).toBe(false)
    expect(
      isInputFlagVisible(
        'updateCase',
        'attachmentUpdates',
        BEFORE_CUTOFF,
        getFlagValue,
      ),
    ).toBe(false)
  })
})
