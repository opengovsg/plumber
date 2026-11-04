import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { throwAisayDeprecationError } from '../../common/throw-aisay-deprecation-error'

describe('throwAisayDeprecationError', () => {
  it('throws a config StepError', () => {
    let thrown: unknown
    try {
      throwAisayDeprecationError()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(StepError)
    expect(thrown).toMatchObject({
      kind: 'config',
      message: expect.stringContaining('"name":"AISAY is deprecated"'),
    })
    expect((thrown as StepError).message).toContain(
      'Use the \\"Pair - Process an image\\" action instead.',
    )
  })
})
