import type { IGlobalVariable } from '@plumber/types'

import StepError from '@/errors/step'

export function throwVaultDeprecationError($: IGlobalVariable) {
  throw new StepError(
    'Vault workspace is deprecated',
    'Please use tiles or M365-excel instead.',
    $.step.position,
    $.app.name,
  )
}
