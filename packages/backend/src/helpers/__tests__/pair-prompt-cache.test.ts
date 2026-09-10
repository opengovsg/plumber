import { describe, expect, it, vi } from 'vitest'

import {
  injectPromptCacheControl,
  wrapFetchWithPromptCache,
} from '../pair-prompt-cache'

describe('injectPromptCacheControl', () => {
  it('rewrites a string system message to a cached text block', () => {
    const result = injectPromptCacheControl({
      model: 'claude',
      messages: [
        { role: 'system', content: 'You are Plumber AI Builder.' },
        { role: 'user', content: 'Reply with OK.' },
      ],
    })

    expect(result).toEqual({
      model: 'claude',
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are Plumber AI Builder.',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
        { role: 'user', content: 'Reply with OK.' },
      ],
    })
  })

  it('marks cache_control on the last function tool', () => {
    const result = injectPromptCacheControl({
      tools: [
        {
          type: 'function',
          function: { name: 'search', parameters: { type: 'object' } },
        },
        {
          type: 'function',
          function: { name: 'create_flow', parameters: { type: 'object' } },
        },
      ],
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result).toEqual({
      tools: [
        {
          type: 'function',
          function: { name: 'search', parameters: { type: 'object' } },
        },
        {
          type: 'function',
          function: {
            name: 'create_flow',
            parameters: { type: 'object' },
            cache_control: { type: 'ephemeral' },
          },
        },
      ],
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('rewrites a developer system message the OpenAI SDK emits for Claude', () => {
    const result = injectPromptCacheControl({
      messages: [
        { role: 'developer', content: 'You are Plumber AI Builder.' },
        { role: 'user', content: 'Reply with OK.' },
      ],
    })

    expect(result).toEqual({
      messages: [
        {
          role: 'developer',
          content: [
            {
              type: 'text',
              text: 'You are Plumber AI Builder.',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
        { role: 'user', content: 'Reply with OK.' },
      ],
    })
  })

  it('leaves non-system messages unchanged', () => {
    const body = {
      messages: [{ role: 'user', content: 'hello' }],
    }
    expect(injectPromptCacheControl(body)).toEqual(body)
  })

  it('returns non-chat bodies unchanged', () => {
    expect(injectPromptCacheControl(null)).toBeNull()
    expect(injectPromptCacheControl({ prompt: 'hi' })).toEqual({
      prompt: 'hi',
    })
  })
})

describe('wrapFetchWithPromptCache', () => {
  it('injects cache_control into /chat/completions JSON bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'))
    const wrapped = wrapFetchWithPromptCache(fetchImpl)

    await wrapped('https://engine.pair.gov.sg/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        tools: [
          {
            type: 'function',
            function: { name: 'search', parameters: { type: 'object' } },
          },
        ],
        messages: [{ role: 'system', content: 'fixed prompt' }],
      }),
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://engine.pair.gov.sg/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tools: [
            {
              type: 'function',
              function: {
                name: 'search',
                parameters: { type: 'object' },
                cache_control: { type: 'ephemeral' },
              },
            },
          ],
          messages: [
            {
              role: 'system',
              content: [
                {
                  type: 'text',
                  text: 'fixed prompt',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        }),
      }),
    )
  })

  it('does not rewrite non-chat requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'))
    const wrapped = wrapFetchWithPromptCache(fetchImpl)
    const init = {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'system', content: 'fixed prompt' }],
      }),
    }

    await wrapped('https://engine.pair.gov.sg/images/generations', init)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://engine.pair.gov.sg/images/generations',
      init,
    )
  })
})
