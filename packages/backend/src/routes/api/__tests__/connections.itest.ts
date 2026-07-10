import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listConnectionsService: vi.fn(),
}))

vi.mock('@/services/mcp/list-connections', () => ({
  listConnectionsService: mocks.listConnectionsService,
}))

async function executeGetHandler(
  req: Partial<Request>,
  res: Partial<Response>,
) {
  const mod = await import('../connections')
  const router = mod.default
  const getHandler = (router as any).stack.find(
    (layer: any) => layer.route?.methods?.get,
  )?.route?.stack[0]?.handle
  if (!getHandler) {
    throw new Error('GET handler not found in connections router')
  }
  return getHandler(req, res)
}

describe('GET /api/connections', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    vi.clearAllMocks()
    mockReq = {
      query: { appKey: 'formsg' },
      context: {
        currentUser: { id: 'user-1', email: 'test@gov.sg' } as any,
        isAdminOperation: false,
      } as any,
    }
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns connections mapped to { name, value } shape', async () => {
    mocks.listConnectionsService.mockResolvedValue([
      { id: 'conn-1', appKey: 'formsg', verified: true, label: 'My FormSG' },
      {
        id: 'conn-2',
        appKey: 'formsg',
        verified: false,
        label: 'Other FormSG',
      },
    ])

    await executeGetHandler(mockReq, mockRes)

    expect(mocks.listConnectionsService).toHaveBeenCalledWith(
      mockReq.context!.currentUser,
      'formsg',
    )
    expect(mockRes.json).toHaveBeenCalledWith({
      data: [
        { name: 'My FormSG', value: 'conn-1' },
        { name: 'Other FormSG', value: 'conn-2' },
      ],
    })
  })

  it('returns 400 when appKey is missing', async () => {
    mockReq.query = {}

    await executeGetHandler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid request' }),
    )
  })

  it('returns 400 when appKey is empty string', async () => {
    mockReq.query = { appKey: '' }

    await executeGetHandler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
  })

  it('returns 500 when service throws', async () => {
    mocks.listConnectionsService.mockRejectedValue(new Error('DB error'))

    await executeGetHandler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal server error',
    })
  })
})
