import { describe, expect, it } from 'vitest'

import PartialStepError from '../partial-error'
import StepError from '../step'

describe('PartialStepError', () => {
  it('serializes kind and partialRetry into the message', () => {
    const error = new PartialStepError({
      name: 'n',
      solution: 's',
      kind: 'config',
      partialRetry: { buttonMessage: 'Retry' },
    })

    expect(error).toBeInstanceOf(StepError)
    expect(error.kind).toBe('config')
    expect(JSON.parse(error.message)).toEqual({
      name: 'n',
      solution: 's',
      kind: 'config',
      partialRetry: { buttonMessage: 'Retry' },
    })
  })
})
