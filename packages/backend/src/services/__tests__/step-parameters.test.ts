import { describe, expect, it, vi } from 'vitest'

vi.mock('@/apps', async () => {
  const { createVersionedStepTransformer } = await import(
    '@/helpers/transform-step-parameters'
  )
  return {
    default: {
      appWithTransformer: {
        stepTransformer: createVersionedStepTransformer({
          migratedAction: [
            (parameters) => ({ ...parameters, migrated: true }),
            (parameters) => ({ ...parameters, renamed: parameters.old }),
          ],
        }),
      },
      appWithoutTransformer: {},
    },
  }
})

import { prepareStepParameters } from '../step-parameters'

describe('prepareStepParameters', () => {
  it('applies every pending migration and returns the latest version', () => {
    expect(
      prepareStepParameters({
        appKey: 'appWithTransformer',
        key: 'migratedAction',
        parameters: { old: 'value' },
        version: 1,
      }),
    ).toEqual({
      parameters: { old: 'value', migrated: true, renamed: 'value' },
      version: 3,
    })
  })

  it('skips migrations the step version already has', () => {
    expect(
      prepareStepParameters({
        appKey: 'appWithTransformer',
        key: 'migratedAction',
        parameters: { old: 'value' },
        version: 2,
      }),
    ).toEqual({
      parameters: { old: 'value', renamed: 'value' },
      version: 3,
    })
  })

  it('keeps parameters for a key with no migrations on a transformer app', () => {
    expect(
      prepareStepParameters({
        appKey: 'appWithTransformer',
        key: 'plainAction',
        parameters: { a: 1 },
        version: 1,
      }),
    ).toEqual({ parameters: { a: 1 }, version: 1 })
  })

  it('returns the input unchanged for an app without a transformer', () => {
    const parameters = { a: 1 }

    expect(
      prepareStepParameters({
        appKey: 'appWithoutTransformer',
        key: 'anyAction',
        parameters,
        version: 4,
      }),
    ).toEqual({ parameters, version: 4 })
  })

  it('returns the input unchanged when the step has no key', () => {
    expect(
      prepareStepParameters({
        appKey: 'appWithTransformer',
        key: null,
        parameters: { a: 1 },
        version: 2,
      }),
    ).toEqual({ parameters: { a: 1 }, version: 2 })
  })
})
