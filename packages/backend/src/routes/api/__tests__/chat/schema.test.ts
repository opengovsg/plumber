import { describe, expect, it } from 'vitest'

import { chatRequestSchema } from '../../chat/schema'

describe('chatRequestSchema', () => {
  const validMessage = {
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'Hello' }],
  }

  describe('valid requests', () => {
    it('should accept a valid request with one message', () => {
      const result = chatRequestSchema.safeParse({
        messages: [validMessage],
      })
      expect(result.success).toBe(true)
    })

    it('should accept a valid request with sessionId', () => {
      const result = chatRequestSchema.safeParse({
        messages: [validMessage],
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept assistant role', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          { role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should accept step-start part type', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              { type: 'text', text: 'Working...' },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should accept data-isChatReady part with flowSteps', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            role: 'assistant',
            parts: [
              {
                type: 'data-isChatReady',
                data: {
                  isChatReady: true,
                  flowSteps: {
                    name: 'My Workflow',
                    trigger: {
                      type: 'trigger',
                      appKey: 'formsg',
                      key: 'newSubmission',
                      description: 'New form submission',
                    },
                    actions: [
                      {
                        type: 'action',
                        appKey: 'postman',
                        key: 'sendTransactionalEmail',
                        description: 'Send email',
                        config: { stepName: 'Send email' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should accept data-isChatReady part with error', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            role: 'assistant',
            parts: [
              {
                type: 'data-isChatReady',
                data: {
                  isChatReady: true,
                  error: 'Invalid trigger detected.',
                },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    // TODO (kevinkim-ogp): remove this in the next release
    it('should accept data-isChatReady part with only isChatReady (legacy format)', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            role: 'assistant',
            parts: [
              {
                type: 'data-isChatReady',
                data: { isChatReady: false },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('messages validation', () => {
    it('should reject empty messages array', () => {
      const result = chatRequestSchema.safeParse({
        messages: [],
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Messages array must contain at least one message',
      )
    })

    it('should reject more than 50 messages', () => {
      const messages = Array(51).fill(validMessage)
      const result = chatRequestSchema.safeParse({ messages })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Cannot send more than 50 messages',
      )
    })
  })

  describe('role validation', () => {
    it('should reject system role', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          { role: 'system', parts: [{ type: 'text', text: 'You are...' }] },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid role', () => {
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'admin', parts: [{ type: 'text', text: 'Hello' }] }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('parts validation', () => {
    it('should reject empty parts array', () => {
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'user', parts: [] }],
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Message must have at least one part',
      )
    })

    it('should reject more than 50 parts', () => {
      const parts = Array(51).fill({ type: 'text', text: 'part' })
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'user', parts }],
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Message cannot have more than 50 parts',
      )
    })
  })

  describe('text validation', () => {
    it('should accept empty text from assistant tool-call steps', () => {
      // The AI SDK emits text: "" before each tool call when the LLM goes
      // straight to calling a tool. This part is echoed back by the frontend
      // on subsequent turns, so empty strings must be valid.
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'assistant', parts: [{ type: 'text', text: '' }] }],
      })
      expect(result.success).toBe(true)
    })

    it('should reject text exceeding 10000 characters', () => {
      const longText = 'a'.repeat(10001)
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'user', parts: [{ type: 'text', text: longText }] }],
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Text cannot exceed 10000 characters',
      )
    })

    it('should accept text at exactly 10000 characters', () => {
      const maxText = 'a'.repeat(10000)
      const result = chatRequestSchema.safeParse({
        messages: [{ role: 'user', parts: [{ type: 'text', text: maxText }] }],
      })
      expect(result.success).toBe(true)
    })

    it('should trim text before validation', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: '  hello  ' }] },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].parts[0]).toEqual({
          type: 'text',
          text: 'hello',
        })
      }
    })
  })

  describe('tracing id validation', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('should accept a request with chatId and ddRumSessionId', () => {
      const result = chatRequestSchema.safeParse({
        messages: [validMessage],
        chatId: validUuid,
        ddRumSessionId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      })
      expect(result.success).toBe(true)
    })

    it('should accept a legacy request with only sessionId', () => {
      const result = chatRequestSchema.safeParse({
        messages: [validMessage],
        sessionId: validUuid,
      })
      expect(result.success).toBe(true)
    })

    it('should accept a request with all tracing ids missing', () => {
      const result = chatRequestSchema.safeParse({
        messages: [validMessage],
      })
      expect(result.success).toBe(true)
    })

    it.each(['chatId', 'ddRumSessionId', 'sessionId'])(
      'should accept an empty %s',
      (field) => {
        const result = chatRequestSchema.safeParse({
          messages: [validMessage],
          [field]: '',
        })
        expect(result.success).toBe(true)
      },
    )

    it.each(['chatId', 'ddRumSessionId', 'sessionId'])(
      'should reject a malformed %s',
      (field) => {
        const result = chatRequestSchema.safeParse({
          messages: [validMessage],
          [field]: 'not-a-uuid',
        })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toBe('Must be a valid UUID')
      },
    )
  })
})
