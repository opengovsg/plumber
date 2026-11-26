import type { StepErrorKind } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import RetriableError from '../retriable-error'
import { getErrorDetailsKind } from '../step'

function makeRetriableError(
  error: ConstructorParameters<typeof RetriableError>[0]['error'],
  kind: StepErrorKind,
): RetriableError {
  return new RetriableError({
    error,
    delayInMs: 'default',
    delayType: 'step',
    kind,
  })
}

describe('RetriableError message', () => {
  it.each([
    { label: 'a plain string', error: 'e', expected: { error: 'e' } },
    {
      label: 'an object',
      error: { name: 'n', solution: 's' },
      expected: { name: 'n', solution: 's' },
    },
  ])('adds the kind to $label', ({ error, expected }) => {
    const retriableError = makeRetriableError(error, 'third-party')

    expect(JSON.parse(retriableError.message)).toEqual({
      ...expected,
      kind: 'third-party',
    })
  })

  it.each(['config', 'third-party', 'internal'] as const)(
    'saves the %s kind where the saved step error is read',
    (kind) => {
      const retriableError = makeRetriableError('e', kind)

      expect(getErrorDetailsKind(JSON.parse(retriableError.message))).toBe(kind)
    },
  )
})
