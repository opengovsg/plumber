import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createNewChatDraft, extractContinuationPrompt } from '../new-chat'

// The test environment doesn't expose `crypto` as a global (no jsdom/browser
// shim). Wire it up from Node's built-in webcrypto so the tests can run.
beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
})

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('extractContinuationPrompt', () => {
  it('extracts and trims the text inside a <code> block', () => {
    expect(
      extractContinuationPrompt(
        'Sure, try this:\n<code>  Build a form  </code>',
      ),
    ).toBe('Build a form')
  })

  it('returns an empty string when there is no <code> block', () => {
    expect(extractContinuationPrompt('No code here')).toBe('')
  })

  it('returns an empty string for undefined input', () => {
    expect(extractContinuationPrompt(undefined)).toBe('')
  })
})

describe('createNewChatDraft', () => {
  it('mints a valid UUID chatId', () => {
    expect(createNewChatDraft().chatId).toMatch(UUID_REGEX)
  })

  it('mints a new chatId on every call (a new chat is always a new session)', () => {
    const ids = new Set(
      Array.from({ length: 5 }, () => createNewChatDraft().chatId),
    )
    expect(ids.size).toBe(5)
  })

  it('seeds chatInput with the continuation prompt and starts with no messages', () => {
    const draft = createNewChatDraft('<code>Send a Slack message</code>')
    expect(draft.chatInput).toBe('Send a Slack message')
    expect(draft.chatMessages).toEqual([])
  })
})
