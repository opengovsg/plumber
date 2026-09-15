import { describe, expect, it } from 'vitest'

import getEditableConnectionLabel from '../auth/get-editable-connection-label'

describe('Postman SMS getEditableConnectionLabel', () => {
  it('returns an empty string when there is no stored name', () => {
    expect(getEditableConnectionLabel()).toBe('')
  })

  it('strips the test prefix', () => {
    expect(
      getEditableConnectionLabel({ screenName: '[TEST] My Campaign' }),
    ).toBe('My Campaign')
  })

  it('leaves production labels unchanged', () => {
    expect(getEditableConnectionLabel({ screenName: 'My Campaign' })).toBe(
      'My Campaign',
    )
  })
})
