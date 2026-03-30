import StepError from '@/errors/step'

export function throwVaultDeprecationError() {
  throw new StepError(
    'Vault workspace is deprecated',
    'Please use tiles or M365-excel instead.',
  )
}
