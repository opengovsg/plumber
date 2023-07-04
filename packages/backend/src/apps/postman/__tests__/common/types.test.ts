import { assert, beforeEach, describe, expect, it } from 'vitest'

import { emailSchema } from '../../common/types'

describe('postman email schema zod validation', () => {
  let validPayload: Record<string, unknown>

  beforeEach(() => {
    validPayload = {
      destinationEmail: 'recipient@example.com ',
      subject: ' asd',
      body: 'hello\nhihi',
      replyTo: 'replyto@example.com',
      senderName: 'sender name',
    }
  })

  it('should validate a single valid email', () => {
    const result = emailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual(['recipient@example.com'])
    expect(result.data.subject).toEqual('asd')
    expect(result.data.body).toEqual('hello<br>hihi')
    expect(result.data.replyTo).toEqual('replyto@example.com')
    expect(result.data.senderName).toEqual('sender name')
  })

  it('should validate multiple valid emails', () => {
    validPayload.destinationEmail =
      'recipient@example.com, recipient2@example.com,recipient3@example.com'
    const result = emailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual([
      'recipient@example.com',
      'recipient2@example.com',
      'recipient3@example.com',
    ])
  })

  it('should validate empty email strings or strings with only whitespaces', () => {
    validPayload.destinationEmail = '   '
    const result = emailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual([])

    validPayload.destinationEmail = ''
    const result2 = emailSchema.safeParse(validPayload)
    assert(result2.success === true) // using assert here for type assertion
    expect(result2.data.destinationEmail).toEqual([])
  })

  it('should fail if any of the email string is invalid', () => {
    validPayload.destinationEmail = 'recipient,,recipient3@example.com'
    const result = emailSchema.safeParse(validPayload)
    expect(result.success).toEqual(false)
  })

  it('should fail if email string is not defined', () => {
    validPayload.destinationEmail = undefined
    const result = emailSchema.safeParse(validPayload)
    expect(result.success).toEqual(false)
  })
})
