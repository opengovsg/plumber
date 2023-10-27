import type { IApp, IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'

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
    it('retries errors with Retry-After appropriately', () => {
      // TODO: AFTER PR ALIGNMENT
    })

    it.each([
      { type: 'http', details: { error: 'read ECONNRESET' } },
      { type: 'http', details: { error: 'connect ETIMEDOUT 1.2.3.4:123' } },
      { type: 'http', status: 504 },
    ])('retries connectivity errors', (errorDetails: IJSONObject) => {
      const callback = () => handleErrorAndThrow(errorDetails)

      // Assert it throws, and that it doesn't throw the wrong type of error.
      expect(callback).toThrowError(RetriableError)
      expect(callback).not.toThrowError(UnrecoverableError)
    })

    it.each([
      {}, // Edge case - empty object just in case
      { type: 'app', error: {} },
      {
        type: 'http',
        status: 500,
        details: { description: 'Internal Server Error' },
      },
      { type: 'http', error: 'connect ECONNREFUSED 1.2.3.4' },
      { error: 'no type for some reason' },
    ])('does not retry other types of errors', (errorDetails) => {
      const callback = () => handleErrorAndThrow(errorDetails as IJSONObject)
      expect(callback).toThrowError(UnrecoverableError)
    })
  })
})
