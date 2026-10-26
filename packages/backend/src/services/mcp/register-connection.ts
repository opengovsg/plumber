import apps from '@/apps'
import { UserFacingError } from '@/errors/user-facing-error'
import Step from '@/models/step'
import type User from '@/models/user'
import { loadAccessibleStep } from '@/services/access'
import { isForeignPersonalConnection } from '@/services/connection'
import { registerConnectionForFlow } from '@/services/connection-registration'

import { PublishedPipeError } from './published-pipe-error'

export interface RegisterConnectionResult {
  registered: boolean
  message: string
}

export async function registerConnectionService(
  user: User,
  stepId: string,
  connectionId: string,
): Promise<RegisterConnectionResult> {
  const step = await loadAccessibleStep({
    user,
    stepId,
    role: 'editor',
  })

  if (!step) {
    throw new UserFacingError('Step not found')
  }

  const connection = await user
    .withAccessibleConnections({ requiredRole: 'viewer' })
    .findOne({ 'connections.id': connectionId })

  if (!connection) {
    throw new UserFacingError('Connection not found')
  }

  if (isForeignPersonalConnection(connection, user.id)) {
    throw new UserFacingError(
      'You cannot use a personal connection that you do not own',
    )
  }

  if (connection.key !== step.appKey) {
    throw new UserFacingError('Connection app does not match step app')
  }

  const app = apps[step.appKey ?? '']
  if (!app?.auth) {
    throw new UserFacingError('App not found or does not support auth')
  }

  if (step.flow.active) {
    throw new PublishedPipeError()
  }

  const result = await registerConnectionForFlow({
    user,
    app,
    connection,
    flow: step.flow,
  })

  if (result === 'unsupported') {
    throw new UserFacingError('App does not support connection registration')
  }

  if (result === 'unverified') {
    throw new UserFacingError('Connection is not verified')
  }

  await Step.query().patchAndFetchById(stepId, { connectionId })

  return { registered: true, message: 'Connection registered successfully' }
}
