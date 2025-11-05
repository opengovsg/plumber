import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getAuthenticatedContext: vi.fn(),
  getLdFlagValue: vi.fn(),
  langfuseClient: {
    prompt: {
      get: vi.fn(),
    },
  },
  startActiveObservation: vi.fn(),
  streamText: vi.fn(),
}))

vi.mock('../middleware/authentication', () => ({
  getAuthenticatedContext: mocks.getAuthenticatedContext,
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/langfuse', () => ({
  langfuseClient: mocks.langfuseClient,
}))

vi.mock('@langfuse/tracing', () => ({
  startActiveObservation: mocks.startActiveObservation,
}))

vi.mock('ai', () => ({
  convertToModelMessages: vi.fn((msgs) => msgs),
  smoothStream: vi.fn(() => ({})),
  streamText: mocks.streamText,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/helpers/pair', () => ({
  model: {},
  MODEL_TYPE: 'test-model',
}))

vi.mock('@/config/app', () => ({
  default: {
    appEnv: 'test',
  },
}))

// Helper function to get and execute the POST handler from the chat router
async function executeChatPostHandler(
  req: Partial<Request>,
  res: Partial<Response>,
) {
  const chatModule = await import('../chat')
  const router = chatModule.default

  // Extract the POST handler
  const postHandler = (router as any).stack.find(
    (layer: any) => layer.route?.methods?.post,
  )?.route?.stack[0]?.handle

  if (!postHandler) {
    throw new Error('POST handler not found in chat router')
  }

  return postHandler(req, res)
}

describe('Chat Route Authentication', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    mockReq = {
      body: {
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        ],
      },
      context: {
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      } as any,
    } as Partial<Request>

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      headersSent: false,
      end: vi.fn(),
    } as Partial<Response>

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication Requirements', () => {
    it('should call getAuthenticatedContext on every request', async () => {
      const mockContext: Context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      mocks.getAuthenticatedContext.mockReturnValueOnce(mockContext)
      mocks.getLdFlagValue.mockResolvedValueOnce({
        chatPrompt: 'aids-chat-v0',
        version: 'production',
      })
      mocks.langfuseClient.prompt.get.mockResolvedValueOnce({
        prompt: 'test prompt',
      })

      // Mock streamText to return a mock result
      const mockResult = {
        pipeUIMessageStreamToResponse: vi.fn(),
      }
      mocks.startActiveObservation.mockImplementationOnce(
        async (name, callback) => {
          const mockTrace = {
            updateTrace: vi.fn(),
            startObservation: vi.fn(() => ({
              update: vi.fn(),
            })),
            update: vi.fn(),
            traceId: 'test-trace-id',
          }
          return await callback(mockTrace)
        },
      )
      mocks.streamText.mockResolvedValueOnce(mockResult)

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getAuthenticatedContext).toHaveBeenCalledWith(mockReq)
    })

    it('should throw error when user is not authenticated', async () => {
      mocks.getAuthenticatedContext.mockImplementationOnce(() => {
        throw new Error('User must be authenticated')
      })

      await expect(executeChatPostHandler(mockReq, mockRes)).rejects.toThrow(
        'User must be authenticated',
      )

      expect(mocks.getAuthenticatedContext).toHaveBeenCalledWith(mockReq)
      // Should not reach getLdFlagValue since authentication failed
      expect(mocks.getLdFlagValue).not.toHaveBeenCalled()
    })

    it('should use authenticated user email for feature flag lookup', async () => {
      const mockContext: Context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'feature-test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      mocks.getAuthenticatedContext.mockReturnValueOnce(mockContext)
      mocks.getLdFlagValue.mockResolvedValueOnce({
        chatPrompt: 'aids-chat-v0',
        version: 'production',
      })
      mocks.langfuseClient.prompt.get.mockResolvedValueOnce({
        prompt: 'test prompt',
      })

      const mockResult = {
        pipeUIMessageStreamToResponse: vi.fn(),
      }
      mocks.startActiveObservation.mockImplementationOnce(
        async (name, callback) => {
          const mockTrace = {
            updateTrace: vi.fn(),
            startObservation: vi.fn(() => ({
              update: vi.fn(),
            })),
            update: vi.fn(),
            traceId: 'test-trace-id',
          }
          return await callback(mockTrace)
        },
      )
      mocks.streamText.mockResolvedValueOnce(mockResult)

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder-prompt-config',
        'feature-test@plumber.gov.sg',
        expect.any(Object),
      )
    })

    it('should validate request body before processing', async () => {
      const mockContext: Context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      // Invalid request body (empty messages)
      mockReq.body = {
        messages: [],
      }

      mocks.getAuthenticatedContext.mockReturnValueOnce(mockContext)
      mocks.getLdFlagValue.mockResolvedValueOnce({
        chatPrompt: 'aids-chat-v0',
        version: 'production',
      })

      await executeChatPostHandler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Messages array is required',
      })
    })
  })

  describe('Admin User Access', () => {
    it('should allow admin users to access the endpoint', async () => {
      const mockContext: Context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

      mocks.getAuthenticatedContext.mockReturnValueOnce(mockContext)
      mocks.getLdFlagValue.mockResolvedValueOnce({
        chatPrompt: 'aids-chat-v0',
        version: 'production',
      })
      mocks.langfuseClient.prompt.get.mockResolvedValueOnce({
        prompt: 'test prompt',
      })

      const mockResult = {
        pipeUIMessageStreamToResponse: vi.fn(),
      }
      mocks.startActiveObservation.mockImplementationOnce(
        async (name, callback) => {
          const mockTrace = {
            updateTrace: vi.fn(),
            startObservation: vi.fn(() => ({
              update: vi.fn(),
            })),
            update: vi.fn(),
            traceId: 'test-trace-id',
          }
          return await callback(mockTrace)
        },
      )
      mocks.streamText.mockResolvedValueOnce(mockResult)

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getAuthenticatedContext).toHaveBeenCalledWith(mockReq)
      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder-prompt-config',
        'admin@plumber.gov.sg',
        expect.any(Object),
      )
    })
  })
})
