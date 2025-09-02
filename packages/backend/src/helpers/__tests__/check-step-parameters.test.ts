import { describe, expect, it } from 'vitest'

import validateStepParameters from '../check-step-parameters'

describe('validateStepParameters', () => {
  it('should throw an error if the parameters are invalid', () => {
    const parameters = { items: 'not a variable' }
    expect(() => validateStepParameters(parameters)).toThrow(
      'For each input must be a variable',
    )
  })

  it('should not throw an error if the parameters are valid', () => {
    const parameters = {
      items: '{{step.00000000-0000-0000-0000-000000000000.data}}',
    }
    expect(() => validateStepParameters(parameters)).not.toThrow()
  })

  it('should not throw an error for all other parameters', () => {
    const parameters = {
      subject: '{{step.00000000-0000-0000-0000-000000000000.subject}}',
      body: 'body',
      recipients: '{{step.00000000-0000-0000-0000-000000000000.recipients}}',
      senderName: 'sender name',
      replyTo: 'replyto@example.com',
      attachments: ['s3:my-bucket:abcd/file 1.txt'],
    }
    expect(() => validateStepParameters(parameters)).not.toThrow()
  })
})
