import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  promptGet: vi.fn(),
  readCachedPrompt: vi.fn(),
  writeCachedPrompt: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/langfuse', () => ({
  getLangfuseClient: vi.fn(() => ({
    prompt: {
      get: mocks.promptGet,
    },
  })),
}))

// Mock the cache module so these unit tests never open a Redis connection.
vi.mock('@/helpers/ai/get-prompt-cache', () => ({
  readCachedPrompt: mocks.readCachedPrompt,
  writeCachedPrompt: mocks.writeCachedPrompt,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))

import { FALLBACK_CHAT_PROMPT } from '@/helpers/ai/fallback-prompts/chat'
import { getPrompt } from '@/helpers/ai/get-prompt'

describe('getPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeCachedPrompt.mockResolvedValue(undefined)
    mocks.readCachedPrompt.mockResolvedValue(null)
  })

  it('returns the Langfuse prompt and writes it to Redis on success', async () => {
    const livePrompt = {
      prompt: 'live system prompt',
      toJSON: () => '{"name":"chat"}',
    }
    mocks.promptGet.mockResolvedValueOnce(livePrompt)

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result).toBe(livePrompt)
    expect(mocks.promptGet).toHaveBeenCalledWith('chat', {
      label: 'production',
    })
    expect(mocks.writeCachedPrompt).toHaveBeenCalledWith(
      'aiBuilder',
      'chat',
      'production',
      'live system prompt',
    )
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Loaded Langfuse prompt',
      expect.objectContaining({
        event: 'langfuse-prompt-loaded',
        source: 'langfuse',
      }),
    )
  })

  it('returns the Redis-cached prompt when Langfuse fails', async () => {
    mocks.promptGet.mockRejectedValueOnce(new Error('Rome unavailable'))
    mocks.readCachedPrompt.mockResolvedValueOnce('cached system prompt')

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result.prompt).toBe('cached system prompt')
    expect(JSON.parse(result.toJSON())).toMatchObject({
      name: 'chat',
      source: 'redis',
      isFallback: true,
    })
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Using Redis-cached Langfuse prompt',
      expect.objectContaining({ source: 'redis' }),
    )
  })

  it('returns the static fallback when Langfuse and Redis both miss', async () => {
    mocks.promptGet.mockRejectedValueOnce(new Error('Rome unavailable'))
    mocks.readCachedPrompt.mockResolvedValueOnce(null)

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result.prompt).toBe(FALLBACK_CHAT_PROMPT)
    expect(JSON.parse(result.toJSON())).toMatchObject({
      name: 'chat',
      source: 'static',
      isFallback: true,
    })
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Using static Langfuse prompt fallback',
      expect.objectContaining({ source: 'static' }),
    )
  })

  it('rethrows when Langfuse fails and no Redis or static fallback exists', async () => {
    const romeError = new Error('Rome unavailable')
    mocks.promptGet.mockRejectedValueOnce(romeError)
    mocks.readCachedPrompt.mockResolvedValueOnce(null)

    await expect(
      getPrompt('unknown-prompt', 'aiBuilder', 'production'),
    ).rejects.toBe(romeError)
  })
})
