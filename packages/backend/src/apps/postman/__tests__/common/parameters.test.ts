import { assert, beforeEach, describe, expect, it } from 'vitest'

import { transactionalEmailSchema } from '../../common/parameters'

describe('postman transactional email schema zod validation', () => {
  let validPayload: Record<string, unknown>

  beforeEach(() => {
    validPayload = {
      destinationEmail: 'recipient@example.com ',
      subject: ' asd',
      body: '<p>hello</p><p>hihi</p>',
      replyTo: 'replyto@example.com',
      senderName: 'sender name',
      attachments: [],
    }
  })

  it('should validate a single valid email', () => {
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual(['recipient@example.com'])
    expect(result.data.subject).toEqual('asd')
    expect(result.data.body).toEqual('<p>hello</p><p>hihi</p>')
    expect(result.data.replyTo).toEqual('replyto@example.com')
    expect(result.data.senderName).toEqual('sender name')
  })

  it('should validate multiple valid emails', () => {
    validPayload.destinationEmail =
      'recipient@example.com, recipient2@example.com,recipient3@example.com'
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual([
      'recipient@example.com',
      'recipient2@example.com',
      'recipient3@example.com',
    ])
  })

  it('should invalidate empty email strings or strings with only whitespaces', () => {
    const expectedErrorMessage = 'Empty recipient email'
    validPayload.destinationEmail = '   '
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false) // using assert here for type assertion
    expect(result.error?.errors[0].message).toEqual(expectedErrorMessage)

    validPayload.destinationEmail = ''
    const result2 = transactionalEmailSchema.safeParse(validPayload)
    assert(result2.success === false) // using assert here for type assertion
    expect(result.error?.errors[0].message).toEqual(expectedErrorMessage)
  })

  it('should allow for empty values', () => {
    validPayload.destinationEmail =
      'recipient@example.com,,recipient3@example.com'
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === true) // using assert here for type assertion
    expect(result.data.destinationEmail).toEqual([
      'recipient@example.com',
      'recipient3@example.com',
    ])

    validPayload.destinationEmail = 'recipient@example.com,,'
    const result2 = transactionalEmailSchema.safeParse(validPayload)
    assert(result2.success === true) // using assert here for type assertion
    expect(result2.data.destinationEmail).toEqual(['recipient@example.com'])
  })

  it('should fail if any of the email string is invalid', () => {
    validPayload.destinationEmail = 'recipient,,recipient3@example.com'
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Invalid recipient emails')
  })

  it('should fail if email string is not defined', () => {
    validPayload.destinationEmail = undefined
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Required')
  })

  it('should fail if empty subject', () => {
    validPayload.subject = ''
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Empty subject')
  })

  it('should fail if empty body', () => {
    validPayload.body = ''
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Empty body')
  })

  it('should fail if reply to string is invalid type', () => {
    validPayload.replyTo = 123
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual(
      'Expected string, received number',
    )
  })

  it('should pass if reply to string is empty', () => {
    validPayload.replyTo = ''
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === true)
  })

  it('should fail if reply to string is invalid', () => {
    validPayload.replyTo = 'xyz'
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Invalid reply to email')
  })

  it('should fail if empty sender name', () => {
    validPayload.senderName = ''
    const result = transactionalEmailSchema.safeParse(validPayload)
    assert(result.success === false)
    expect(result.error?.errors[0].message).toEqual('Empty sender name')
  })
})
