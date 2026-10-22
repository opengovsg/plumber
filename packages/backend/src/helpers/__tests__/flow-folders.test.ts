import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import {
  applyFolderFilter,
  validateFlowFolderColor,
  validateFlowFolderName,
} from '@/helpers/flow-folders'

describe('applyFolderFilter', () => {
  function createMockBuilder() {
    return {
      whereExists: vi.fn().mockReturnThis(),
      whereNotExists: vi.fn().mockReturnThis(),
    }
  }

  const userId = randomUUID()

  it('is a strict no-op when neither folderId nor unfiled is set', () => {
    const builder = createMockBuilder()

    applyFolderFilter(builder as any, { userId })

    expect(builder.whereExists).not.toHaveBeenCalled()
    expect(builder.whereNotExists).not.toHaveBeenCalled()
  })

  it('is a strict no-op when folderId and unfiled are both null/undefined', () => {
    const builder = createMockBuilder()

    applyFolderFilter(builder as any, {
      userId,
      folderId: null,
      unfiled: null,
    })

    expect(builder.whereExists).not.toHaveBeenCalled()
    expect(builder.whereNotExists).not.toHaveBeenCalled()
  })

  it('is a strict no-op when unfiled is false', () => {
    const builder = createMockBuilder()

    applyFolderFilter(builder as any, { userId, unfiled: false })

    expect(builder.whereExists).not.toHaveBeenCalled()
    expect(builder.whereNotExists).not.toHaveBeenCalled()
  })

  it('applies whereExists when folderId is set', () => {
    const builder = createMockBuilder()
    const folderId = randomUUID()

    applyFolderFilter(builder as any, { userId, folderId })

    expect(builder.whereExists).toHaveBeenCalledTimes(1)
    expect(builder.whereNotExists).not.toHaveBeenCalled()
  })

  it('applies whereNotExists when unfiled is true', () => {
    const builder = createMockBuilder()

    applyFolderFilter(builder as any, { userId, unfiled: true })

    expect(builder.whereNotExists).toHaveBeenCalledTimes(1)
    expect(builder.whereExists).not.toHaveBeenCalled()
  })

  it('prefers folderId over unfiled when both are set', () => {
    const builder = createMockBuilder()
    const folderId = randomUUID()

    applyFolderFilter(builder as any, { userId, folderId, unfiled: true })

    expect(builder.whereExists).toHaveBeenCalledTimes(1)
    expect(builder.whereNotExists).not.toHaveBeenCalled()
  })
})

describe('validateFlowFolderName', () => {
  it('trims surrounding whitespace', () => {
    expect(validateFlowFolderName('  My Folder  ')).toEqual('My Folder')
  })

  it('throws BadUserInputError for an empty name', () => {
    expect(() => validateFlowFolderName('')).toThrow(BadUserInputError)
  })

  it('throws BadUserInputError for a whitespace-only name', () => {
    expect(() => validateFlowFolderName('   ')).toThrow(BadUserInputError)
  })

  it('allows a name at exactly the 60 character cap', () => {
    const name = 'a'.repeat(60)
    expect(validateFlowFolderName(name)).toEqual(name)
  })

  it('throws BadUserInputError for a name over 60 characters', () => {
    const name = 'a'.repeat(61)
    expect(() => validateFlowFolderName(name)).toThrow(BadUserInputError)
  })
})

describe('validateFlowFolderColor', () => {
  it.each(['magenta', 'teal', 'slate', 'amber', 'red', 'blue'])(
    'accepts %s as a valid colour',
    (color) => {
      expect(validateFlowFolderColor(color)).toEqual(color)
    },
  )

  it('throws BadUserInputError for a colour outside the 6 tokens', () => {
    expect(() => validateFlowFolderColor('purple')).toThrow(BadUserInputError)
  })

  it('throws BadUserInputError for an empty colour', () => {
    expect(() => validateFlowFolderColor('')).toThrow(BadUserInputError)
  })
})
