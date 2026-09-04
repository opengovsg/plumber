import { describe, expect, it } from 'vitest'

import { Message } from '@/hooks/useChatStream'

import { extractLastFormUrl } from '../helpers'

const makeMessage = (text: string, isUser = true): Message =>
  ({ id: text, text, isUser }) as Message

describe('extractLastFormUrl', () => {
  it('returns undefined when no messages mention a form URL', () => {
    const messages = [makeMessage('help me automate a slack alert')]
    expect(extractLastFormUrl(messages)).toBeUndefined()
  })

  it('extracts a prod form share URL from a message', () => {
    const messages = [
      makeMessage(
        'my form is https://form.gov.sg/654ab1234abc1a012345f1e0 thanks',
      ),
    ]
    expect(extractLastFormUrl(messages)).toBe(
      'https://form.gov.sg/654ab1234abc1a012345f1e0',
    )
  })

  it('extracts a staging admin-form URL', () => {
    const messages = [
      makeMessage(
        'see https://staging.form.gov.sg/admin/form/654ab1234abc1a012345f1e0',
      ),
    ]
    expect(extractLastFormUrl(messages)).toBe(
      'https://staging.form.gov.sg/admin/form/654ab1234abc1a012345f1e0',
    )
  })

  it('returns the most recent URL when several appear across messages', () => {
    const messages = [
      makeMessage('first: https://form.gov.sg/aaaab1234abc1a012345f1e0'),
      makeMessage('some assistant reply', false),
      makeMessage('actually use https://form.gov.sg/bbbbb1234abc1a012345f1e0'),
    ]
    expect(extractLastFormUrl(messages)).toBe(
      'https://form.gov.sg/bbbbb1234abc1a012345f1e0',
    )
  })

  it('returns the last URL within a single message', () => {
    const messages = [
      makeMessage(
        'either https://form.gov.sg/aaaab1234abc1a012345f1e0 or https://form.gov.sg/bbbbb1234abc1a012345f1e0',
      ),
    ]
    expect(extractLastFormUrl(messages)).toBe(
      'https://form.gov.sg/bbbbb1234abc1a012345f1e0',
    )
  })

  it('ignores non-FormSG URLs', () => {
    const messages = [
      makeMessage('https://example.com/654ab1234abc1a012345f1e0'),
    ]
    expect(extractLastFormUrl(messages)).toBeUndefined()
  })
})
