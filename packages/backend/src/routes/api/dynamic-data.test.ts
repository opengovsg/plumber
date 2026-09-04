import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'

const mocks = vi.hoisted(() => ({
  getDynamicDataService: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/services/mcp/get-dynamic-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/mcp/get-dynamic-data')>()),
  getDynamicDataService: mocks.getDynamicDataService,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

import {
  DynamicDataPrerequisiteError,
  getDynamicDataService,
} from '@/services/mcp/get-dynamic-data'

import router from './dynamic-data'

function makeReq(body: Record<string, unknown>) {
  return {
    body,
    context: {
      currentUser: { id: 'user-1', email: 'test@example.com' },
    },
  }
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
}

function getHandler() {
  return router.stack[0].route.stack[0].handle
}

describe('POST /api/dynamic-data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for an invalid request body', async () => {
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({}) as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid request' }),
    )
    expect(getDynamicDataService).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
  })

  it('returns 400 with the message when the service throws a UserFacingError', async () => {
    vi.mocked(getDynamicDataService).mockRejectedValue(
      new UserFacingError('Step not found'),
    )
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({ stepId: 'step-1', key: 'table' }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Step not found' })
    expect(mocks.logError).toHaveBeenCalledWith(
      'Failed to fetch dynamic data',
      {
        event: 'dynamic-data-error',
        stepId: 'step-1',
        key: 'table',
        userId: 'user-1',
        error: 'Step not found',
      },
    )
  })

  it('returns 400 with code prerequisite_missing for a DynamicDataPrerequisiteError', async () => {
    vi.mocked(getDynamicDataService).mockRejectedValue(
      new DynamicDataPrerequisiteError("Missing required value for 'tableId'"),
    )
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({ stepId: 'step-1', key: 'table' }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing required value for 'tableId'",
      code: 'prerequisite_missing',
    })
    expect(mocks.logError).toHaveBeenCalledWith(
      'Failed to fetch dynamic data',
      {
        event: 'dynamic-data-error',
        stepId: 'step-1',
        key: 'table',
        userId: 'user-1',
        error: "Missing required value for 'tableId'",
      },
    )
  })

  it('returns 500 for an unexpected error', async () => {
    vi.mocked(getDynamicDataService).mockRejectedValue(new Error('boom'))
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({ stepId: 'step-1', key: 'table' }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
    expect(mocks.logError).toHaveBeenCalledWith(
      'Failed to fetch dynamic data',
      {
        event: 'dynamic-data-error',
        stepId: 'step-1',
        key: 'table',
        userId: 'user-1',
        error: 'boom',
      },
    )
  })

  it('logs a sanitised axios error and still returns a generic 500', async () => {
    const axiosError = new axios.AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      {
        url: 'https://example.com/secret-path',
        headers: { Authorization: 'Bearer leaked-token' },
      } as never,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
        data: { access_token: 'leaked-token' },
      },
    )
    vi.mocked(getDynamicDataService).mockRejectedValue(axiosError)
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({ stepId: 'step-1', key: 'table' }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
    expect(mocks.logError).toHaveBeenCalledWith(
      'Failed to fetch dynamic data',
      {
        event: 'dynamic-data-error',
        stepId: 'step-1',
        key: 'table',
        userId: 'user-1',
        error: 'Request failed with status code 401',
      },
    )

    const loggedCalls = JSON.stringify(mocks.logError.mock.calls)
    expect(loggedCalls).not.toContain('leaked-token')
    expect(loggedCalls).not.toContain('secret-path')
  })

  it('returns 200 with the fetched data on success', async () => {
    const data = [{ name: 'Sheet 1', value: 'sheet-1' }]
    vi.mocked(getDynamicDataService).mockResolvedValue(data)
    const res = makeRes()
    const handler = getHandler()

    await handler(
      makeReq({
        stepId: 'step-1',
        key: 'table',
        parameters: { spreadsheetId: 'abc' },
      }) as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
      vi.fn(),
    )

    expect(getDynamicDataService).toHaveBeenCalledWith({
      user: { id: 'user-1', email: 'test@example.com' },
      stepId: 'step-1',
      key: 'table',
      parameters: { spreadsheetId: 'abc' },
    })
    expect(res.json).toHaveBeenCalledWith({ data })
    expect(mocks.logError).not.toHaveBeenCalled()
  })
})
