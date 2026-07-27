import type { IGlobalVariable } from '@plumber/types'

import apps from '@/apps'
import { UserFacingError } from '@/errors/user-facing-error'
import globalVariable from '@/helpers/global-variable'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

export interface RegisterConnectionResult {
  registered: boolean
  message: string
}

export async function registerConnectionService(
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

  const connection = await user
    .withAccessibleConnections({ requiredRole: 'viewer' })
    .findOne({ 'connections.id': connectionId })

  if (!connection) {
    throw new UserFacingError('Connection not found')
  }

  if (connection.userId !== null && connection.userId !== user.id) {
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

  const connectionRegistrationType = app.auth.connectionRegistrationType
  if (!connectionRegistrationType) {
    throw new UserFacingError('App does not support connection registration')
  }

  // 'global' registration (e.g. m365-excel) is not tied to a specific flow, so
  // $ is built without one — mirrors makeGlobalVariableForGlobalRegistration in
  // the equivalent GraphQL registerConnection mutation.
  let $: IGlobalVariable
  if (connectionRegistrationType === 'global') {
    $ = await globalVariable({ connection, app, user })
  } else {
    const flow = await Flow.query().findById(step.flowId)
    if (!flow) {
      throw new UserFacingError('Flow not found')
    }
    $ = await globalVariable({ connection, app, flow, user })
  }

  const isVerified = await app.auth.isStillVerified($)
  if (!isVerified) {
    throw new UserFacingError('Connection is not verified')
  }

  await app.auth.registerConnection?.($)

  await Step.query().patchAndFetchById(stepId, { connectionId })

  return { registered: true, message: 'Connection registered successfully' }
}
