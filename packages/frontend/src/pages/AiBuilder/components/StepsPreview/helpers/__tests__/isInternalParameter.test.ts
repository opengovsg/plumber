import { describe, expect, it } from 'vitest'

import { isInternalParameter } from '../isInternalParameter'

describe('isInternalParameter', () => {
  it('hides the MRF stage data on a FormSG step', () => {
    expect(isInternalParameter('formsg', 'mrf')).toBe(true)
  })

  it('keeps the other FormSG parameters', () => {
    expect(isInternalParameter('formsg', 'formId')).toBe(false)
  })

  it('keeps an mrf parameter on another app', () => {
    expect(isInternalParameter('postman', 'mrf')).toBe(false)
  })
})
