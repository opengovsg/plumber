import { IApp, IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { doesActionProcessFiles, handleErrorAndThrow } from '../actions'

vi.mock('@/apps', () => ({
  default: {
    'test-app': {
      key: 'test-app',
      actions: [
        { key: 'action1', doesFileProcessing: true },
        { key: 'action2', doesFileProcessing: false },
      ],
    } as IApp,
    'legacy-app': {
      key: 'legacy-app',
      actions: [{ key: 'action1' }],
    } as IApp,
  },
}))

describe('action helper functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('file processing', () => {
    it('returns true for actions that process files', async () => {
      const result = await doesActionProcessFiles('test-app', 'action1')
      expect(result).toEqual(true)
    })

    it('returns false for actions that do not process files', async () => {
      const result = await doesActionProcessFiles('test-app', 'action2')
      expect(result).toEqual(false)
    })

    it('assumes that action does not process files if flag is not specified', async () => {
      const result = await doesActionProcessFiles('legacy-app', 'action1')
      expect(result).toEqual(false)
    })

    it('returns false for actions that do not exist', async () => {
      const result = await doesActionProcessFiles('test-app', 'herp')
      expect(result).toEqual(false)
    })

    it('returns false for apps that do not exist', async () => {
      const result = await doesActionProcessFiles('topkek', 'action1')
      expect(result).toEqual(false)
    })
  })

  describe('error handling and retry', () => {
    it.each([
      { details: { error: 'read ECONNRESET' } },
      { details: { error: 'connect ETIMEDOUT 1.2.3.4:123' } },
      { status: 504 },
      { status: 429 },
    ])('retries connectivity errors', (errorDetails: IJSONObject) => {
      const callback = () => handleErrorAndThrow(errorDetails)

      // Assert it throws, and that it doesn't throw the wrong type of error.
      expect(callback).toThrowError(Error)
      expect(callback).not.toThrowError(UnrecoverableError)
    })

    it.each([
      {}, // Edge case - empty object just in case
      { status: 500, details: { description: 'Internal Server Error' } },
      { error: 'connect ECONNREFUSED 1.2.3.4' },
    ])('does not retry other types of errors', (errorDetails) => {
      const callback = () => handleErrorAndThrow(errorDetails as IJSONObject)
      expect(callback).toThrowError(UnrecoverableError)
    })
  })
})
