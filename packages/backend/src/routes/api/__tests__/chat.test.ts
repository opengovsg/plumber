import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  langfuseClient: {
    prompt: {
      get: vi.fn(),
    },
  },
  startActiveObservation: vi.fn(),
  streamText: vi.fn(),
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

describe('Chat Route Handler', () => {
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

  describe('Handler Behavior', () => {
    it('should process authenticated requests', async () => {
      // Context is set by middleware before reaching handler
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

      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder-prompt-config',
        'test@plumber.gov.sg',
        expect.any(Object),
      )
    })

    it('should throw error when context is missing user', async () => {
      // Simulate missing context (should be caught by middleware in production)
      mockReq.context = undefined

      await expect(executeChatPostHandler(mockReq, mockRes)).rejects.toThrow()

      // Should not reach getLdFlagValue since context is missing
      expect(mocks.getLdFlagValue).not.toHaveBeenCalled()
    })

    it('should use authenticated user email for feature flag lookup', async () => {
      // Set context with different user email
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'feature-test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

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
      // Invalid request body (empty messages)
      mockReq.body = {
        messages: [],
      }

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
    it('handler can process admin requests (blocking handled by middleware)', async () => {
      // Note: blockAdminOperations middleware blocks admin users
      // before they reach this handler. This test verifies the handler itself
      // has no admin-specific logic and would work if an admin context reached it.
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

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
        'admin@plumber.gov.sg',
        expect.any(Object),
      )
    })
  })
})
