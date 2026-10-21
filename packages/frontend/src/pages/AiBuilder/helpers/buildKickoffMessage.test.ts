import { describe, expect, it } from 'vitest'

import {
  buildFormConnectedMessage,
  buildKickoffMessage,
  formatUserMessageForDisplay,
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

describe('buildFormConnectedMessage', () => {
  // Mid-conversation announcement — same shape as the kickoff but without
  // the suggestion request, so the LLM continues from where it left off.
  it('omits the workflow-suggestion request', () => {
    expect(
      buildFormConnectedMessage(
        'Workshop Registration 2026',
        '3f2c8e10-1234-5678-9abc-def012345678',
        '654ab1234abc1a012345f1e0',
      ),
    ).toBe(
      'I\'ve connected my FormSG form "Workshop Registration 2026" ' +
        '(id: 3f2c8e10-1234-5678-9abc-def012345678, ' +
        'form id: 654ab1234abc1a012345f1e0).',
    )
  })
})
