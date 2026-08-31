import { describe, expect, it } from 'vitest'

import {
  getConnectionEnvLabel,
  getEditableConnectionLabel,
} from '../connection-label'

describe('getEditableConnectionLabel', () => {
  it('returns an empty string when there is no stored name', () => {
    expect(getEditableConnectionLabel('lettersg')).toBe('')
  })

  it('strips the Postman test prefix', () => {
    expect(
      getEditableConnectionLabel('postman-sms', '[TEST] My Campaign'),
    ).toBe('My Campaign')
  })

  it('strips a single LetterSG staging suffix', () => {
    expect(getEditableConnectionLabel('lettersg', 'My Letter [STAGING]')).toBe(
      'My Letter',
    )
  })

  it('leaves other apps unchanged', () => {
    expect(getEditableConnectionLabel('gathersg', 'My Gather [STAGING]')).toBe(
      'My Gather [STAGING]',
    )
  })
})

describe('getConnectionEnvLabel', () => {
  it('maps LetterSG stored env values', () => {
    expect(getConnectionEnvLabel('test')).toBe('Staging')
    expect(getConnectionEnvLabel('live')).toBe('Production')
    expect(getConnectionEnvLabel('prod')).toBeNull()
  })
})
