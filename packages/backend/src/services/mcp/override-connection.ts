import { UserFacingError } from '@/errors/user-facing-error'
import Step from '@/models/step'
import type User from '@/models/user'

import {
  type RegisterConnectionResult,
  registerConnectionService,
} from './register-connection'
import { clearConnectionConflict } from './step-ai-builder-config'

export const NO_CONNECTION_CONFLICT_MESSAGE =
  'No webhook conflict is on record for this step and connection, so there is nothing to override. Ask which pipe or form the user means. Nothing was changed.'

export class NoConnectionConflictError extends UserFacingError {
  constructor() {
    super(NO_CONNECTION_CONFLICT_MESSAGE)
    this.name = 'NoConnectionConflictError'
  }
}

/**
 * The register_connection tool path. The chat prompt only allows this call
 * after a connectionConflict and an explicit yes, but a prompt rule is
 * probabilistic and the call overwrites a FormSG webhook, so the marker
 * recorded by update_step_parameters is the deterministic gate.
 */
export async function overrideConnectionService(
  user: User,
  stepId: string,
  connectionId: string,
): Promise<RegisterConnectionResult> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .findOne({ 'steps.id': stepId })

  if (!step) {
    throw new UserFacingError('Step not found')
  }

  if (step.config?.aiBuilderConnectionConflict?.connectionId !== connectionId) {
    throw new NoConnectionConflictError()
  }

  const result = await registerConnectionService(user, stepId, connectionId)

  await Step.query().patchAndFetchById(stepId, {
    config: clearConnectionConflict(step.config),
  })

  return result
}
