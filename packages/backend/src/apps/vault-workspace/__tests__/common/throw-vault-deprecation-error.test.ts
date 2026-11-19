import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { throwVaultDeprecationError } from '../../common/throw-vault-deprecation-error'

describe('throwVaultDeprecationError', () => {
  it('throws a config StepError', () => {
    let thrown: unknown
    try {
      throwVaultDeprecationError()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(StepError)
    expect(thrown).toMatchObject({
      kind: 'config',
      message: expect.stringContaining(
        '"name":"Vault workspace is deprecated"',
      ),
    })
    expect((thrown as StepError).message).toContain(
      'Please use tiles or M365-excel instead.',
    )
  })
})
