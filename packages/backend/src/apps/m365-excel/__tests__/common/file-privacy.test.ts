import { describe, expect, it } from 'vitest'

import { getWriteAccessEmailCandidates } from '../../common/file-privacy'

describe('getWriteAccessEmailCandidates', () => {
  it('adds the SWDA alias for legacy domains', () => {
    expect(getWriteAccessEmailCandidates('test@wsg.gov.sg')).toEqual([
      'test@wsg.gov.sg',
      'test@swda.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@ssg.gov.sg')).toEqual([
      'test@ssg.gov.sg',
      'test@swda.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@ssg-wsg.gov.sg')).toEqual([
      'test@ssg-wsg.gov.sg',
      'test@swda.gov.sg',
    ])
  })

  it('returns only the original email for other domains', () => {
    expect(getWriteAccessEmailCandidates('test@open.gov.sg')).toEqual([
      'test@open.gov.sg',
    ])
    expect(getWriteAccessEmailCandidates('test@swda.gov.sg')).toEqual([
      'test@swda.gov.sg',
    ])
  })
})
