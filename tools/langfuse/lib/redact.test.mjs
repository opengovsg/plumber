import assert from 'node:assert/strict'
import test from 'node:test'

import { createRedactor } from './redact.mjs'

test('replaces emails, NRICs and phone numbers with stable placeholders', () => {
  const redactor = createRedactor()
  const out = redactor.redact({
    messages: [
      {
        role: 'user',
        content:
          'Email jane.tan@agency.gov.sg or call 9123 4567. NRIC S1234567A.',
      },
      {
        role: 'assistant',
        content: 'I will email Jane.Tan@agency.gov.sg and +65 91234567.',
      },
    ],
  })
  assert.equal(
    out.messages[0].content,
    'Email <EMAIL_1> or call <PHONE_1>. NRIC <NRIC_1>.',
  )
  assert.equal(out.messages[1].content, 'I will email <EMAIL_1> and <PHONE_2>.')
  assert.equal(redactor.replacements(), 4)
})

test('keeps form ids and leaves non-string values alone', () => {
  const redactor = createRedactor()
  const out = redactor.redact({
    formId: '64f1a2b3c4d5e6f7a8b9c0d1',
    count: 3,
    nothing: null,
  })
  assert.deepEqual(out, {
    formId: '64f1a2b3c4d5e6f7a8b9c0d1',
    count: 3,
    nothing: null,
  })
})
