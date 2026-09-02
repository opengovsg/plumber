import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'

vi.mock('@/services/mcp/get-dynamic-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/mcp/get-dynamic-data')>()),
  getDynamicDataService: vi.fn(),
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
  })
})
