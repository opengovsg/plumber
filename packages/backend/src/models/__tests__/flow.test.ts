import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors/bad-user-input'
import Flow from '@/models/flow'

describe('flow model', () => {
  const updatedBy = randomUUID()

  describe('assertNotUpdatedSince', () => {
    it('should not throw when timestamps match', () => {
      const flow = new Flow()
      const updatedAt = new Date('2023-01-01T00:00:00.000Z')

      flow.updatedAt = updatedAt.toISOString()

      const clientUpdatedAt = String(updatedAt.getTime())

      expect(() =>
        flow.assertNotUpdatedSince(clientUpdatedAt, updatedBy),
      ).not.toThrow()
    })

    it('should throw BadUserInputError when timestamps mismatch', () => {
      const flow = new Flow()
      const updatedAt = new Date('2023-01-01T00:00:00.000Z')

      flow.updatedAt = updatedAt.toISOString()

      const mismatched = String(updatedAt.getTime() + 1)

      expect(() =>
        flow.assertNotUpdatedSince(mismatched, updatedBy),
      ).toThrowError(BadUserInputError)
      expect(() => flow.assertNotUpdatedSince(mismatched, updatedBy)).toThrow(
        'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.',
      )
    })

    it('should throw BadUserInputError when input is not a number', () => {
      const flow = new Flow()
      const updatedAt = new Date('2023-01-01T00:00:00.000Z')

      flow.updatedAt = updatedAt.toISOString()

      expect(() =>
        flow.assertNotUpdatedSince('not-a-number', updatedBy),
      ).toThrowError(BadUserInputError)
      expect(() =>
        flow.assertNotUpdatedSince('not-a-number', updatedBy),
      ).toThrow(
        'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.',
      )
    })
  })
})
