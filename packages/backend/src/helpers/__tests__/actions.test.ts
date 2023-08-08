import { IApp } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { doesActionProcessFiles } from '../actions'

const mocks = vi.hoisted(() => ({
  appFindAll: vi.fn(),
}))

vi.mock('@/models/app', () => ({
  default: {
    findAll: mocks.appFindAll,
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
      mocks.appFindAll.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'action1')
      expect(result).toEqual(true)
    })

    it('returns false for actions that do not process files', async () => {
      mocks.appFindAll.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'action2')
      expect(result).toEqual(false)
    })

    it('assumes that action does not process files if flag is not specified', async () => {
      mocks.appFindAll.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('legacy-app', 'action1')
      expect(result).toEqual(false)
    })

    it('returns false for actions that do not exist', async () => {
      mocks.appFindAll.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('test-app', 'herp')
      expect(result).toEqual(false)
    })

    it('returns false for apps that do not exist', async () => {
      mocks.appFindAll.mockResolvedValue(apps)
      const result = await doesActionProcessFiles('topkek', 'action1')
      expect(result).toEqual(false)
    })
  })
})
