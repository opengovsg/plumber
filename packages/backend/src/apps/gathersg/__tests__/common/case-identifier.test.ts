import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import {
  caseIdentifierSchema,
  resolveCaseIdentifier,
} from '../../common/case-identifier'

const MOCK_CASE_UUID = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7H'
const MOCK_CASE_REF = '261007-00001'

function makeGlobal(post: ReturnType<typeof vi.fn>): IGlobalVariable {
  return {
    http: { post },
  } as unknown as IGlobalVariable
}

describe('caseIdentifierSchema', () => {
  it('accepts a case uuid', () => {
    expect(caseIdentifierSchema.parse(MOCK_CASE_UUID)).toBe(MOCK_CASE_UUID)
  })

  it('accepts a case ref', () => {
    expect(caseIdentifierSchema.parse(`  ${MOCK_CASE_REF}  `)).toBe(
      MOCK_CASE_REF,
    )
  })

  it('rejects an empty value', () => {
    expect(() => caseIdentifierSchema.parse('   ')).toThrow(
      'Please do not leave the case uuid or case ref empty',
    )
  })

  it('rejects a value that matches neither format', () => {
    expect(() => caseIdentifierSchema.parse('261007-0001')).toThrow(
      'Please enter a valid case uuid or case ref',
    )
  })
})

describe('resolveCaseIdentifier', () => {
  it('returns a case uuid without searching', async () => {
    const post = vi.fn()

    await expect(
      resolveCaseIdentifier(makeGlobal(post), MOCK_CASE_UUID),
    ).resolves.toBe(MOCK_CASE_UUID)
    expect(post).not.toHaveBeenCalled()
  })

  it('returns the uuid from a nested search page', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          total: 1,
          data: [{ uuid: MOCK_CASE_UUID, caseRef: MOCK_CASE_REF }],
        },
      },
    })

    await expect(
      resolveCaseIdentifier(makeGlobal(post), MOCK_CASE_REF),
    ).resolves.toBe(MOCK_CASE_UUID)
  })

  it('throws when total reports more matches than the page', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        total: 2,
        data: [{ uuid: MOCK_CASE_UUID }],
      },
    })

    await expect(
      resolveCaseIdentifier(makeGlobal(post), MOCK_CASE_REF),
    ).rejects.toThrow('More than one case found')
  })

  it('throws when search returns no case', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { data: [] },
    })

    await expect(
      resolveCaseIdentifier(makeGlobal(post), MOCK_CASE_REF),
    ).rejects.toThrow('No case found for case ref 261007-00001')
  })

  it('throws when the search response shape is unexpected', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { cases: [{ uuid: MOCK_CASE_UUID }] },
    })

    await expect(
      resolveCaseIdentifier(makeGlobal(post), MOCK_CASE_REF),
    ).rejects.toThrow('Unable to read the case search result')
  })
})
