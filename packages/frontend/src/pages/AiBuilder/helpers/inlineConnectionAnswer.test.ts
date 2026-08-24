import { describe, expect, it } from 'vitest'

import { buildPickerAnswerMessage, extractConnectionResult } from '../helpers'

describe('buildPickerAnswerMessage', () => {
  it('formats the question, label, and id into the picker answer contract', () => {
    expect(
      buildPickerAnswerMessage(
        'Which Slack workspace?',
        'My Workspace',
        'conn-123',
      ),
    ).toBe('Q: Which Slack workspace?\nA: My Workspace (id: conn-123)')
  })
})

describe('extractConnectionResult', () => {
  it('returns the connection id and the user-entered screenName as label', () => {
    const response = {
      createConnection: { id: 'conn-123' },
      fields: { screenName: 'My Connection', apiKey: 'secret' },
    }
    expect(extractConnectionResult(response, 'PaySG')).toEqual({
      connectionId: 'conn-123',
      label: 'My Connection',
    })
  })

  it('falls back to the provided label when no screenName field was submitted', () => {
    const response = {
      createConnection: { id: 'conn-456' },
      fields: { token: 'bot-token-value' },
    }
    expect(extractConnectionResult(response, 'Telegram')).toEqual({
      connectionId: 'conn-456',
      label: 'Telegram',
    })
  })

  it('returns null when no connection was created (e.g. the step sequence failed)', () => {
    expect(extractConnectionResult({}, 'PaySG')).toBeNull()
  })
})
