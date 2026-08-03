import { describe, expect, it } from 'vitest'

import {
  buildUrlSharedKickoffMessage,
  buildUrlSharedMessage,
  extractFormIdFromLabel,
  formatFormUrlLabel,
  formatUserMessageForDisplay,
  isValidFormUrlInput,
  normalizeFormUrlInput,
  stripFormIdPrefix,
} from '../helpers'

describe('buildUrlSharedMessage', () => {
  it('shares the url plainly mid-conversation', () => {
    expect(
      buildUrlSharedMessage('https://form.gov.sg/654ab1234abc1a012345f1e0'),
    ).toBe("Here's my form: https://form.gov.sg/654ab1234abc1a012345f1e0.")
  })

  it('asks for suggestions as the first message', () => {
    expect(
      buildUrlSharedKickoffMessage(
        'https://form.gov.sg/654ab1234abc1a012345f1e0',
      ),
    ).toBe(
      "Here's my form: https://form.gov.sg/654ab1234abc1a012345f1e0. " +
        'Suggest workflows I can build with it.',
    )
  })
})

describe('isValidFormUrlInput', () => {
  it.each([
    'https://form.gov.sg/654ab1234abc1a012345f1e0',
    'https://form.gov.sg/654ab1234abc1a012345f1e0/',
    'https://staging.form.gov.sg/admin/form/654ab1234abc1a012345f1e0',
    '654ab1234abc1a012345f1e0',
    '  https://form.gov.sg/654ab1234abc1a012345f1e0  ',
  ])('accepts %s', (input) => {
    expect(isValidFormUrlInput(input)).toBe(true)
  })

  it.each([
    'https://example.com/654ab1234abc1a012345f1e0',
    'https://form.gov.sg/not-a-form-id',
    'my form is https://form.gov.sg/654ab1234abc1a012345f1e0',
    'abc123',
    '',
  ])('rejects %s', (input) => {
    expect(isValidFormUrlInput(input)).toBe(false)
  })
})

describe('normalizeFormUrlInput', () => {
  it('expands a bare form id into a prod share URL', () => {
    expect(normalizeFormUrlInput('  654ab1234abc1a012345f1e0 ')).toBe(
      'https://form.gov.sg/654ab1234abc1a012345f1e0',
    )
  })

  it('leaves full URLs untouched', () => {
    expect(
      normalizeFormUrlInput(
        'https://staging.form.gov.sg/654ab1234abc1a012345f1e0',
      ),
    ).toBe('https://staging.form.gov.sg/654ab1234abc1a012345f1e0')
  })
})

describe('formatFormUrlLabel', () => {
  it('drops the protocol and shortens the form id', () => {
    expect(
      formatFormUrlLabel('https://form.gov.sg/654ab1234abc1a012345f1e0'),
    ).toBe('form.gov.sg/654ab1…f1e0')
  })
})

describe('extractFormIdFromLabel', () => {
  it('pulls the form id out of a screenName', () => {
    expect(
      extractFormIdFromLabel(
        '654ab1234abc1a012345f1e0 - Workshop Registration',
      ),
    ).toBe('654ab1234abc1a012345f1e0')
  })

  it('returns null when no form id is present', () => {
    expect(extractFormIdFromLabel('My Custom Label')).toBeNull()
  })
})

describe('stripFormIdPrefix', () => {
  it('drops the form-id segment from a screenName', () => {
    expect(
      stripFormIdPrefix('654ab1234abc1a012345f1e0 - Workshop Registration'),
    ).toBe('Workshop Registration')
  })

  it('keeps env/MRF prefixes', () => {
    expect(
      stripFormIdPrefix(
        '[STAGING] [MRF] 654ab1234abc1a012345f1e0 - Workshop Registration',
      ),
    ).toBe('[STAGING] [MRF] Workshop Registration')
  })

  it('returns labels without a form-id prefix unchanged', () => {
    expect(stripFormIdPrefix('My Custom Label')).toBe('My Custom Label')
  })
})

describe('formatUserMessageForDisplay', () => {
  it('strips picker id suffixes', () => {
    expect(
      formatUserMessageForDisplay(
        'Q: Which form?\nA: My Form (id: 3f2c8e10-1234-5678-9abc-def012345678)',
      ),
    ).toBe('Q: Which form?\nA: My Form')
  })
})
