import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  getAllLdFlags: vi.fn(),
  getPrompt: vi.fn(),
  getActiveTraceId: vi.fn(),
  updateActiveObservation: vi.fn(),
  updateActiveTrace: vi.fn(),
  observe: vi.fn((fn) => fn),
  streamText: vi.fn(),
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: vi.fn(),
  getChatReadiness: vi.fn(),
  pipeWebResponseToExpress: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
  getAllLdFlags: mocks.getAllLdFlags,
}))

vi.mock('@/helpers/pair/get-prompt', () => ({
  getPrompt: mocks.getPrompt,
}))

vi.mock('@langfuse/tracing', () => ({
  observe: mocks.observe,
  getActiveTraceId: mocks.getActiveTraceId,
  updateActiveObservation: mocks.updateActiveObservation,
  updateActiveTrace: mocks.updateActiveTrace,
}))

vi.mock('ai', () => ({
  convertToModelMessages: vi.fn((msgs) => msgs),
  smoothStream: vi.fn(() => ({})),
  streamText: mocks.streamText,
  createUIMessageStream: mocks.createUIMessageStream,
  createUIMessageStreamResponse: mocks.createUIMessageStreamResponse,
}))

vi.mock('../chat/get-chat-readiness', () => ({
  getChatReadiness: mocks.getChatReadiness,
}))

vi.mock('@/helpers/stream', () => ({
  pipeWebResponseToExpress: mocks.pipeWebResponseToExpress,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    error: mocks.loggerError,
  },
}))

vi.mock('@/helpers/pair', () => ({
  model: {},
  MODEL_TYPE: 'test-model',
  engineProvider: {
    chatModel: vi.fn().mockReturnValue({}),
  },
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
      setHeader: vi.fn(),
      write: vi.fn(),
    } as Partial<Response>

    // Reset mocks
    vi.clearAllMocks()

    // Set up default streaming mocks
    setupStreamingMocks()
  })

  // Helper to set up the streaming-related mocks
  function setupStreamingMocks() {
    // Mock streamText to return a result with toUIMessageStream
    const mockStreamResult = {
      toUIMessageStream: vi.fn().mockReturnValue({
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true }),
        }),
      }),
    }
    mocks.streamText.mockReturnValue(mockStreamResult)

    // Mock createUIMessageStream to execute the callback and return a stream
    mocks.createUIMessageStream.mockImplementation(({ execute }) => {
      // Create a mock writer
      const mockWriter = {
        write: vi.fn(),
        merge: vi.fn(),
      }
      // Execute the callback (fire and forget for test purposes)
      execute({ writer: mockWriter })
      // Return a mock stream
      return {
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true }),
        }),
      }
    })

    // Mock createUIMessageStreamResponse to return a Response-like object
    mocks.createUIMessageStreamResponse.mockReturnValue({
      headers: new Map([['Content-Type', 'text/plain; charset=utf-8']]),
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true }),
        }),
      },
    })

    // Mock getChatReadiness
    mocks.getChatReadiness.mockResolvedValue(false)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Handler Behavior', () => {
    it('should process authenticated requests', async () => {
      // Context is set by middleware before reaching handler
      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'aids-chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({})
      mocks.getPrompt
        .mockResolvedValueOnce({
          prompt: 'test prompt',
          toJSON: vi.fn(),
        })
        .mockResolvedValueOnce({
          prompt: 'readiness prompt',
        })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder',
        'test@plumber.gov.sg',
        expect.any(Object),
      )
      expect(mocks.getAllLdFlags).toHaveBeenCalledWith('test@plumber.gov.sg')
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
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({})
      mocks.getPrompt
        .mockResolvedValueOnce({
          prompt: 'test prompt',
          toJSON: vi.fn(),
        })
        .mockResolvedValueOnce({
          prompt: 'readiness prompt',
        })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder',
        'feature-test@plumber.gov.sg',
        expect.any(Object),
      )
      expect(mocks.getAllLdFlags).toHaveBeenCalledWith(
        'feature-test@plumber.gov.sg',
      )
    })

    it('should validate request body before processing', async () => {
      // Invalid request body (empty messages)
      mockReq.body = {
        messages: [],
      }

      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({})

      await executeChatPostHandler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            message: 'Messages array must contain at least one message',
          }),
        ]),
      })
    })

    it('should throw error when AI Builder is not enabled', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: false,
      })

      await executeChatPostHandler(mockReq, mockRes)
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'You do not have permissions to use AI Builder!',
      })
    })

    it('should exclude Excel from restricted apps when user has Excel enabled', async () => {
      let capturedMessages: any[] = []

      // Capture the messages passed to streamText
      mocks.streamText.mockImplementation((options) => {
        capturedMessages = options.messages
        return {
          toUIMessageStream: vi.fn().mockReturnValue({
            getReader: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ done: true }),
            }),
          }),
        }
      })

      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({
        'app_m365-excel': true, // Excel enabled
        'app_other-app': false, // Other app disabled
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Verify system message does not include Excel in restricted apps
      expect(capturedMessages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining(
          'this user does not have access to the following apps: other-app',
        ),
      })
      expect(capturedMessages[0].content).not.toContain('m365-excel')
    })

    it('should include Excel in restricted apps when user does not have Excel enabled', async () => {
      let capturedMessages: any[] = []

      // Capture the messages passed to streamText
      mocks.streamText.mockImplementation((options) => {
        capturedMessages = options.messages
        return {
          toUIMessageStream: vi.fn().mockReturnValue({
            getReader: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ done: true }),
            }),
          }),
        }
      })

      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({
        'app_m365-excel': false, // Excel disabled
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Verify system message includes Excel in restricted apps
      expect(capturedMessages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining(
          'this user does not have access to the following apps: m365-excel',
        ),
      })
    })

    it('should show empty restricted apps list when user has access to all apps', async () => {
      let capturedMessages: any[] = []

      // Capture the messages passed to streamText
      mocks.streamText.mockImplementation((options) => {
        capturedMessages = options.messages
        return {
          toUIMessageStream: vi.fn().mockReturnValue({
            getReader: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ done: true }),
            }),
          }),
        }
      })

      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({
        'app_m365-excel': true,
        'some-other-flag': false, // Non-app flag
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Verify system message shows empty restricted apps (empty string after "apps: ")
      expect(capturedMessages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining(
          'this user does not have access to the following apps: .',
        ),
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
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({})
      mocks.getPrompt
        .mockResolvedValueOnce({
          prompt: 'test prompt',
          toJSON: vi.fn(),
        })
        .mockResolvedValueOnce({
          prompt: 'readiness prompt',
        })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
        'ai-builder',
        'admin@plumber.gov.sg',
        expect.any(Object),
      )
      expect(mocks.getAllLdFlags).toHaveBeenCalledWith('admin@plumber.gov.sg')
    })
  })

  describe('getChatReadiness Error Handling', () => {
    it('should gracefully handle getChatReadiness failure and write isReady: false', async () => {
      // Track the onFinish callback and writer
      let capturedOnFinish:
        | ((event: { text: string }) => Promise<void>)
        | null = null
      let capturedWriter: { write: ReturnType<typeof vi.fn> } | null = null

      // Mock streamText to capture the onFinish callback
      mocks.streamText.mockImplementation((options) => {
        capturedOnFinish = options.onFinish
        return {
          toUIMessageStream: vi.fn().mockReturnValue({
            getReader: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ done: true }),
            }),
          }),
        }
      })

      // Mock createUIMessageStream to capture the writer
      mocks.createUIMessageStream.mockImplementation(({ execute }) => {
        capturedWriter = {
          write: vi.fn(),
        }
        execute({ writer: { ...capturedWriter, merge: vi.fn() } })
        return {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true }),
          }),
        }
      })

      mocks.createUIMessageStreamResponse.mockReturnValue({
        headers: new Map([['Content-Type', 'text/plain; charset=utf-8']]),
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true }),
          }),
        },
      })

      // Mock getChatReadiness to throw an error
      mocks.getChatReadiness.mockRejectedValue(
        new Error('LLM service unavailable'),
      )

      mocks.getLdFlagValue.mockResolvedValueOnce({
        enabled: true,
        config: {
          chatPromptName: 'chat-v0',
          chatReadinessPromptName: 'chat-readiness-v0',
          chatReadinessModel: 'claude-haiku-4-5-20251001-v1:rsn',
          version: 'production',
        },
      })
      mocks.getAllLdFlags.mockResolvedValueOnce({})
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Verify onFinish was captured and execute it
      expect(capturedOnFinish).not.toBeNull()
      expect(capturedWriter).not.toBeNull()

      // Execute onFinish to trigger the error handling
      await capturedOnFinish!({ text: 'Test response' })

      // Verify error was logged
      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Error checking chat readiness',
        expect.objectContaining({
          error: 'LLM service unavailable',
        }),
      )

      // Verify fallback isReady: false was written
      expect(capturedWriter!.write).toHaveBeenCalledWith({
        type: 'data-isChatReady',
        data: { isChatReady: false },
      })
    })
  })
})
