import { IApp, IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { doesActionProcessFiles, handleErrorAndThrow } from '../actions'

const mocks = vi.hoisted(() => ({
  getAllAppsWithFunctions: vi.fn(),
}))

vi.mock('@/models/app', () => ({
  default: {
    getAllAppsWithFunctions: mocks.getAllAppsWithFunctions,
  },
}))

describe('action helper functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('file processing', () => {
    let apps: IApp[]

    beforeEach(() => {
      apps = [
        {
          key: 'test-app',
          actions: [
            { key: 'action1', doesFileProcessing: true },
            { key: 'action2', doesFileProcessing: false },
          ],
        },
        {
          key: 'legacy-app',
          actions: [{ key: 'action1' }],
        },
      ] as unknown as IApp[]
    })

    it('returns true for actions that process files', async () => {
      mocks.getAllAppsWithFunctions.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'action1')
      expect(result).toEqual(true)
    })

    it('returns false for actions that do not process files', async () => {
      mocks.getAllAppsWithFunctions.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'action2')
      expect(result).toEqual(false)
    })

    it('assumes that action does not process files if flag is not specified', async () => {
      mocks.getAllAppsWithFunctions.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('legacy-app', 'action1')
      expect(result).toEqual(false)
    })

    it('returns false for actions that do not exist', async () => {
      mocks.getAllAppsWithFunctions.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'herp')
      expect(result).toEqual(false)
    })

    it('returns false for apps that do not exist', async () => {
      mocks.getAllAppsWithFunctions.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('topkek', 'action1')
      expect(result).toEqual(false)
    })
  })

  describe('error handling and retry', () => {
    it.each([
      { errorMessage: 'read ECONNRESET' },
      { errorMessage: 'connect ETIMEDOUT 1.2.3.4:123' },
    ])('retries connectivity errors', ({ errorMessage }) => {
      const callback = () =>
        handleErrorAndThrow({
          details: {
            error: errorMessage,
          },
        } as IJSONObject)

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
