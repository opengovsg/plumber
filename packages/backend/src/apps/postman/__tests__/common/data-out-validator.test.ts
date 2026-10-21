import { assert, describe, expect, it } from 'vitest'

import { dataOutSchema } from '../../common/data-out-validator'

describe('postman dataOutSchema', () => {
  // Regression test: a partial retry re-parses the previous execution step's
  // dataOut with this schema. If it rejects an address that
  // transactionalEmailSchema (parameters.ts) accepted as input, the retry
  // treats the whole dataOut as invalid and resends to every recipient.
  it('accepts a recipient with RFC 5322 atext specials that email-validator allowed', () => {
    const result = dataOutSchema.safeParse({
      status: ['ACCEPTED'],
      recipient: ["user!#$%&'*+/=?^_`{|}~name@example.com"],
    })
    assert(result.success === true)
    expect(result.data.recipient).toEqual([
      "user!#$%&'*+/=?^_`{|}~name@example.com",
    ])
  })

  it('accepts a reply_to with RFC 5322 atext specials that email-validator allowed', () => {
    const result = dataOutSchema.safeParse({
      status: ['ACCEPTED'],
      recipient: ['recipient@example.com'],
      reply_to: "user!#$%&'*+/=?^_`{|}~name@example.com",
    })
    assert(result.success === true)
    expect(result.data.reply_to).toEqual(
      "user!#$%&'*+/=?^_`{|}~name@example.com",
    )
  })
})
