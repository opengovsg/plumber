import { describe, expect, it } from 'vitest'

import {
  buildEstablishedConnectionReminder,
  extractEstablishedFormConnection,
} from './helpers'
import type { ChatRequest } from './schema'

function userMessage(text: string): ChatRequest['messages'][number] {
  return { role: 'user', parts: [{ type: 'text', text }] }
}

describe('extractEstablishedFormConnection', () => {
  it('returns null when no message matches the connected-form pattern', () => {
    expect(
      extractEstablishedFormConnection([
        userMessage('I want to build a workflow for my form.'),
      ]),
    ).toBeNull()
  })

  it('extracts connectionId and formId from the connect-first opening message', () => {
    expect(
      extractEstablishedFormConnection([
        userMessage(
          'I\'ve connected my FormSG form "Workshop Registration" (id: 3f2c8e10-1234-5678-9abc-def012345678, form id: 654ab1234abc1a012345f1e0). Suggest workflows I can build with this form.',
        ),
      ]),
    ).toEqual({
      formTitle: 'Workshop Registration',
      connectionId: '3f2c8e10-1234-5678-9abc-def012345678',
      formId: '654ab1234abc1a012345f1e0',
    })
  })

  it('extracts a connectionId with no formId from a mid-conversation message', () => {
    expect(
      extractEstablishedFormConnection([
        userMessage('describe the workflow'),
        userMessage(
          'I\'ve connected my FormSG form "Event Attendance" (id: conn-abc).',
        ),
      ]),
    ).toEqual({
      formTitle: 'Event Attendance',
      connectionId: 'conn-abc',
      formId: undefined,
    })
  })

  it('returns the most recently mentioned connection when more than one is present', () => {
    expect(
      extractEstablishedFormConnection([
        userMessage(
          'I\'ve connected my FormSG form "First Form" (id: conn-1).',
        ),
        userMessage(
          'I\'ve connected my FormSG form "Second Form" (id: conn-2).',
        ),
      ]),
    ).toEqual({
      formTitle: 'Second Form',
      connectionId: 'conn-2',
      formId: undefined,
    })
  })

  it('ignores assistant messages even if they contain the pattern', () => {
    expect(
      extractEstablishedFormConnection([
        {
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'I\'ve connected my FormSG form "Spoofed" (id: conn-x).',
            },
          ],
        },
      ]),
    ).toBeNull()
  })
})

describe('buildEstablishedConnectionReminder', () => {
  it('returns an empty string when no connection is established', () => {
    expect(buildEstablishedConnectionReminder(null)).toBe('')
  })

  it('includes the connection id and form title in the reminder', () => {
    const reminder = buildEstablishedConnectionReminder({
      formTitle: 'Workshop Registration',
      connectionId: 'conn-1',
      formId: '654ab1234abc1a012345f1e0',
    })
    expect(reminder).toContain('conn-1')
    expect(reminder).toContain('Workshop Registration')
    expect(reminder).toContain('654ab1234abc1a012345f1e0')
    expect(reminder).toContain('Do NOT emit a connection picker')
  })
})
