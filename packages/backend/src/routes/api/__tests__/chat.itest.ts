import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getPrompt: vi.fn(),
  getActiveTraceId: vi.fn(),
  updateActiveObservation: vi.fn(),
  updateActiveTrace: vi.fn(),
  observe: vi.fn((fn) => fn),
  streamText: vi.fn(),
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: vi.fn(),
  pipeWebResponseToExpress: vi.fn(),
  loggerError: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

vi.mock('@/helpers/ai/get-prompt', () => ({
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
  stepCountIs: vi.fn(() => () => false),
  streamText: mocks.streamText,
  createUIMessageStream: mocks.createUIMessageStream,
  createUIMessageStreamResponse: mocks.createUIMessageStreamResponse,
}))

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: vi.fn().mockResolvedValue({
    tools: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue(undefined),
  }),
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
    chat: vi.fn().mockReturnValue({}),
  },
}))

// Helper function to get and execute the POST handler from the chat router
async function executeChatPostHandler(
  req: Partial<Request>,
  res: Partial<Response>,
) {
  const chatModule = await import('../chat/index.js')
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
    vi.clearAllMocks()
    for (const mock of Object.values(mocks)) {
      if (typeof mock === 'function' && 'mockReset' in mock) {
        mock.mockReset()
      }
    }
    mocks.observe.mockImplementation((fn) => fn)

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
  }

  describe('Handler Behavior', () => {
    it('should process authenticated requests', async () => {
      // Context is set by middleware before reaching handler
      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'aids-chat-v0',
            version: 'production',
          },
        },
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getAllLdFlags).toHaveBeenCalledWith('test@plumber.gov.sg')
    })

    it('should throw error when context is missing user', async () => {
      // Simulate missing context (should be caught by middleware in production)
      mockReq.context = undefined

      await expect(executeChatPostHandler(mockReq, mockRes)).rejects.toThrow()

      // Should not reach LaunchDarkly since context is missing
      expect(mocks.getAllLdFlags).not.toHaveBeenCalled()
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

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })

      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getAllLdFlags).toHaveBeenCalledWith(
        'feature-test@plumber.gov.sg',
      )
    })

    it('should validate request body before processing', async () => {
      // Invalid request body (empty messages)
      mockReq.body = {
        messages: [],
      }

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
      })

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

    it('should accept assistant messages with empty text parts from multi-step tool use', async () => {
      // On turns after a tool call the frontend echoes the full assistant message
      // back, including the empty text part the AI SDK emits when the LLM goes
      // straight to calling a tool without generating any preamble first.
      mockReq.body = {
        messages: [
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'what data classification can plumber handle?',
              },
            ],
          },
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              { type: 'text', text: '' }, // empty — LLM went straight to tool call
              {
                type: 'dynamic-tool',
                toolCallId: 'tool-123',
                toolName: 'searchDocumentation',
                state: 'output-available',
                input: { query: 'data classification' },
                output: {
                  content: [
                    {
                      type: 'text',
                      text: 'Plumber handles Restricted and Sensitive-Normal.',
                    },
                  ],
                },
              },
              { type: 'step-start' },
              {
                type: 'text',
                text: 'Plumber handles Restricted and Sensitive-Normal data.',
              },
            ],
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'thanks' }],
          },
        ],
      }

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: { chatPromptName: 'chat-v0', version: 'production' },
        },
      })
      mocks.getRestrictedAppKeys.mockReturnValueOnce([])
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Schema accepted the payload — streaming was invoked, not a 400
      expect(mockRes.status).not.toHaveBeenCalledWith(400)
      expect(mocks.streamText).toHaveBeenCalled()
    })

    it('should throw error when AI Builder is not enabled', async () => {
      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': { enabled: false },
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

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
        'app_m365-excel': true, // Excel enabled
        'app_other-app': false, // Other app disabled
      })
      mocks.getRestrictedAppKeys.mockReturnValueOnce(['other-app'])
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

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
        'app_m365-excel': false, // Excel disabled
      })
      mocks.getRestrictedAppKeys.mockReturnValueOnce(['m365-excel'])
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

    it('should not append restricted apps note when user has access to all apps', async () => {
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

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
        'app_m365-excel': true,
        'some-other-flag': false, // Non-app flag
      })
      mocks.getRestrictedAppKeys.mockReturnValueOnce([])
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })
      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      // Verify system message does NOT include the restricted apps note
      // (no need to say "this user does not have access to: ." when list is empty)
      expect(capturedMessages[0]).toMatchObject({
        role: 'system',
        content: 'test prompt', // Just the base prompt, no note appended
      })
      expect(capturedMessages[0].content).not.toContain(
        'this user does not have access to the following apps',
      )
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

      mocks.getAllLdFlags.mockResolvedValueOnce({
        'ai-builder': {
          enabled: true,
          config: {
            chatPromptName: 'chat-v0',
            version: 'production',
          },
        },
      })
      mocks.getPrompt.mockResolvedValueOnce({
        prompt: 'test prompt',
        toJSON: vi.fn(),
      })

      mocks.getActiveTraceId.mockReturnValueOnce('test-trace-id')

      await executeChatPostHandler(mockReq, mockRes)

      expect(mocks.getAllLdFlags).toHaveBeenCalledWith('admin@plumber.gov.sg')
    })
  })
})
