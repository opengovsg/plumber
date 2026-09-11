import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  promptGet: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
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

vi.mock('@/helpers/redis-app-data', () => ({
  redisAppDataClient: {
    get: mocks.redisGet,
    set: mocks.redisSet,
  },
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
import {
  makePromptCacheKey,
  PROMPT_CACHE_TTL_SECONDS,
} from '@/helpers/ai/get-prompt-cache'

describe('getPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the Langfuse prompt and writes it to Redis on success', async () => {
    const livePrompt = {
      prompt: 'live system prompt',
      toJSON: () => '{"name":"chat"}',
    }
    mocks.promptGet.mockResolvedValueOnce(livePrompt)
    mocks.redisSet.mockResolvedValueOnce('OK')

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result).toBe(livePrompt)
    expect(mocks.promptGet).toHaveBeenCalledWith('chat', {
      label: 'production',
    })
    expect(mocks.redisSet).toHaveBeenCalledWith(
      makePromptCacheKey('aiBuilder', 'chat', 'production'),
      expect.stringContaining('live system prompt'),
      'EX',
      PROMPT_CACHE_TTL_SECONDS,
    )
  })

  it('still returns the live prompt when Redis write fails', async () => {
    const livePrompt = {
      prompt: 'live system prompt',
      toJSON: () => '{"name":"chat"}',
    }
    mocks.promptGet.mockResolvedValueOnce(livePrompt)
    mocks.redisSet.mockRejectedValueOnce(new Error('redis down'))

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result).toBe(livePrompt)
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Failed to write Langfuse prompt cache',
      expect.objectContaining({
        event: 'langfuse-prompt-cache-write-error',
      }),
    )
  })

  it('returns the Redis-cached prompt when Langfuse fails', async () => {
    mocks.promptGet.mockRejectedValueOnce(new Error('Rome unavailable'))
    mocks.redisGet.mockResolvedValueOnce(
      JSON.stringify({
        promptText: 'cached system prompt',
        cachedAt: '2026-09-11T00:00:00.000Z',
      }),
    )

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
    mocks.redisGet.mockResolvedValueOnce(null)

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result.prompt).toBe(FALLBACK_CHAT_PROMPT)
    expect(JSON.parse(result.toJSON())).toMatchObject({
      name: 'chat',
      source: 'static',
      isFallback: true,
    })
  })

  it('rethrows when Langfuse fails and no Redis or static fallback exists', async () => {
    const romeError = new Error('Rome unavailable')
    mocks.promptGet.mockRejectedValueOnce(romeError)
    mocks.redisGet.mockResolvedValueOnce(null)

    await expect(
      getPrompt('unknown-prompt', 'aiBuilder', 'production'),
    ).rejects.toBe(romeError)
  })

  it('falls through to static when Redis read fails after Langfuse failure', async () => {
    mocks.promptGet.mockRejectedValueOnce(new Error('Rome unavailable'))
    mocks.redisGet.mockRejectedValueOnce(new Error('redis read failed'))

    const result = await getPrompt('chat', 'aiBuilder', 'production')

    expect(result.prompt).toBe(FALLBACK_CHAT_PROMPT)
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Failed to read Langfuse prompt cache',
      expect.objectContaining({
        event: 'langfuse-prompt-cache-read-error',
      }),
    )
  })
})
