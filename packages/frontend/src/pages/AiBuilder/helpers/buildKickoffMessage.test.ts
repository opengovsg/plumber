import { describe, expect, it } from 'vitest'

import {
  buildKickoffMessage,
  extractFormIdFromLabel,
  formatUserMessageForDisplay,
  stripFormIdPrefix,
} from '../helpers'

describe('buildKickoffMessage', () => {
  // The exact shape is a contract with the system prompt's connect-first
  // intake branch (Langfuse) — if this test needs updating, the prompt's
  // recognition rule must be updated in the same release.
  it('carries the connection and form ids in the parenthetical', () => {
    expect(
      buildKickoffMessage(
        'Workshop Registration 2026',
        '3f2c8e10-1234-5678-9abc-def012345678',
        '654ab1234abc1a012345f1e0',
      ),
    ).toBe(
      'I\'ve connected my FormSG form "Workshop Registration 2026" ' +
        '(id: 3f2c8e10-1234-5678-9abc-def012345678, ' +
        'form id: 654ab1234abc1a012345f1e0). ' +
        'Suggest workflows I can build with this form.',
    )
  })

  it('omits the form id when unknown', () => {
    expect(
      buildKickoffMessage(
        'Workshop Registration 2026',
        '3f2c8e10-1234-5678-9abc-def012345678',
        null,
      ),
    ).toBe(
      'I\'ve connected my FormSG form "Workshop Registration 2026" ' +
        '(id: 3f2c8e10-1234-5678-9abc-def012345678). ' +
        'Suggest workflows I can build with this form.',
    )
  })

  it('displays without the technical parenthetical', () => {
    const message = buildKickoffMessage(
      'Workshop Registration 2026',
      '3f2c8e10-1234-5678-9abc-def012345678',
      '654ab1234abc1a012345f1e0',
    )
    expect(formatUserMessageForDisplay(message)).toBe(
      'I\'ve connected my FormSG form "Workshop Registration 2026". ' +
        'Suggest workflows I can build with this form.',
    )
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
