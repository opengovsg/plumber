import assert from 'node:assert/strict'
import test from 'node:test'

import { createRedactor } from './redact.mjs'

test('matches lowercase NRICs and redacts bearer tokens and Slack tokens', () => {
  const out = createRedactor().redact(
    'nric s1234567a header Authorization: Bearer abcdef1234567890abcdef token xoxb-1234567890-abcdef',
  )
  assert.doesNotMatch(out, /s1234567a|abcdef1234567890|xoxb-/)
})
