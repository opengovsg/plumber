import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPrompt, getPrompts } from './get-prompt'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/helpers/langfuse', () => ({
  getLangfuseClient: () => ({
    prompt: {
      get: mocks.get,
    },
  }),
}))

describe('getPrompt', () => {
  beforeEach(() => {
    mocks.get.mockReset()
  })

  it('fetches a prompt by label', async () => {
    const prompt = { prompt: 'content' }
    mocks.get.mockResolvedValue(prompt)

    await expect(getPrompt('chat', 'aiBuilder', 'latest')).resolves.toBe(prompt)
    expect(mocks.get).toHaveBeenCalledWith('chat', { label: 'latest' })
  })

  it('fetches prompts concurrently and indexes them by name', async () => {
    const resolvers = new Map<string, (value: { prompt: string }) => void>()
    mocks.get.mockImplementation(
      (name: string) =>
        new Promise((resolve) => {
          resolvers.set(name, resolve)
        }),
    )

    const resultPromise = getPrompts(
      ['ai-builder/core', 'ai-builder/align'],
      'aiBuilder',
      'latest',
    )

    expect(mocks.get).toHaveBeenCalledTimes(2)
    resolvers.get('ai-builder/core')?.({ prompt: 'core' })
    resolvers.get('ai-builder/align')?.({ prompt: 'align' })

    const result = await resultPromise
    expect(result.get('ai-builder/core')).toEqual({ prompt: 'core' })
    expect(result.get('ai-builder/align')).toEqual({ prompt: 'align' })
  })
})
