import { describe, expect, it } from 'vitest'

import getEditableConnectionLabel from '../auth/get-editable-connection-label'

describe('LetterSG getEditableConnectionLabel', () => {
  it('returns an empty string when there is no stored name', () => {
    expect(getEditableConnectionLabel()).toBe('')
  })

  it('strips a single staging suffix', () => {
    expect(
      getEditableConnectionLabel({ screenName: 'My Letter [STAGING]' }),
    ).toBe('My Letter')
  })

  it('leaves production labels unchanged', () => {
    expect(getEditableConnectionLabel({ screenName: 'My Letter' })).toBe(
      'My Letter',
    )
  })
})
