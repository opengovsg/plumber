import StepError from '@/errors/step'

export function throwVaultDeprecationError() {
  throw new StepError({
    name: 'Vault workspace is deprecated',
    solution: 'Please use tiles or M365-excel instead.',
    kind: 'config',
  })
}
