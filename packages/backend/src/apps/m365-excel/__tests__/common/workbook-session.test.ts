import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import WorkbookSession from '../../common/workbook-session'

const mocks = vi.hoisted(() => ({
  getSessionIdFromRedis: vi.fn(),
  setSessionIdInRedis: vi.fn(),
  clearSessionIdFromRedis: vi.fn(),
  validateCanAccessFile: vi.fn(),
}))

vi.mock('../../common/workbook-session/redis', () => ({
  getSessionIdFromRedis: mocks.getSessionIdFromRedis,
  setSessionIdInRedis: mocks.setSessionIdInRedis,
  clearSessionIdFromRedis: mocks.clearSessionIdFromRedis,
}))

vi.mock('../../common/file-privacy', () => ({
  validateCanAccessFile: mocks.validateCanAccessFile,
}))

vi.mock('../../common/auth-data', () => ({
  extractAuthDataWithPlumberFolder: () => ({
    tenantKey: 'tenant',
    folderId: 'FOLDER',
  }),
}))

vi.mock('@/config/app-env-vars/m365', () => ({
  getM365TenantInfo: () => ({ sharePointSiteId: 'site-id' }),
}))

function makeGlobalVariable(): IGlobalVariable {
  return {
    user: { email: 'tester@open.gov.sg' },
    flow: { id: 'flow-id' },
    step: { id: 'step-id' },
    execution: { id: 'execution-id' },
    http: {
      request: vi.fn(),
      post: vi.fn(),
    },
  } as unknown as IGlobalVariable
}

describe('WorkbookSession', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.resetAllMocks()
    $ = makeGlobalVariable()
    mocks.getSessionIdFromRedis.mockResolvedValue('session-id')
  })

  describe('acquire', () => {
    it('converts a createSession HttpError to a StepError with its cause', async () => {
      mocks.getSessionIdFromRedis.mockResolvedValue(null)
      const httpError = makeHttpError({
        status: 501,
        data: { error: { code: 'FileCorruptTryRepair' } },
      })
      vi.mocked($.http.post).mockRejectedValue(httpError)

      const error = await WorkbookSession.acquire($, 'file-id').catch(
        (err: unknown) => err,
      )
      expect(error).toBeInstanceOf(StepError)
      expect(error).toMatchObject({ kind: 'config', cause: httpError })
    })

    it('rethrows a non-HttpError from createSession unchanged', async () => {
      mocks.getSessionIdFromRedis.mockResolvedValue(null)
      const retriableError = new RetriableError({
        error: 'Encountered HTTP 503 from MS',
        delayInMs: 'default',
        delayType: 'step',
      })
      vi.mocked($.http.post).mockRejectedValue(retriableError)

      await expect(WorkbookSession.acquire($, 'file-id')).rejects.toBe(
        retriableError,
      )
    })
  })

  describe('request', () => {
    it('retries and clears the session when Graph invalidates it', async () => {
      vi.mocked($.http.request).mockRejectedValue(
        makeHttpError({
          status: 400,
          data: {
            error: {
              code: 'InvalidSession',
              innerError: { code: 'invalidSessionReCreatable' },
            },
          },
        }),
      )
      const session = await WorkbookSession.acquire($, 'file-id')

      await expect(session.request('/tables', 'get')).rejects.toBeInstanceOf(
        RetriableError,
      )
      expect(mocks.clearSessionIdFromRedis).toHaveBeenCalledOnce()
    })

    it('converts any other HttpError to a StepError with its cause', async () => {
      const httpError = makeHttpError({
        status: 404,
        data: { error: { code: 'itemNotFound' } },
      })
      vi.mocked($.http.request).mockRejectedValue(httpError)
      const session = await WorkbookSession.acquire($, 'file-id')

      const error = await session
        .request('/tables', 'get')
        .catch((err: unknown) => err)
      expect(error).toBeInstanceOf(StepError)
      expect(error).toMatchObject({ kind: 'config', cause: httpError })
      expect(mocks.clearSessionIdFromRedis).not.toHaveBeenCalled()
    })

    it('rethrows a non-HttpError unchanged', async () => {
      const stepError = new StepError({
        name: 'Excel request timed out',
        solution: 'solution',
        kind: 'config',
      })
      vi.mocked($.http.request).mockRejectedValue(stepError)
      const session = await WorkbookSession.acquire($, 'file-id')

      await expect(session.request('/tables', 'get')).rejects.toBe(stepError)
    })
  })
})
