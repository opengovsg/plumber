import type { IApp, IGlobalVariable } from '@plumber/types'

import apps from '@/apps'
import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import type Connection from '@/models/connection'
import type User from '@/models/user'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

async function makeGlobalVariableForGlobalRegistration(
  currentUser: User,
  app: IApp,
  connection: Connection,
): Promise<IGlobalVariable> {
  return await globalVariable({
    connection,
    app,
    user: currentUser,
  })
}

async function makeGlobalVariableForPerFlowRegistration(
  currentUser: User,
  app: IApp,
  connection: Connection,
  flowId: string,
): Promise<IGlobalVariable> {
  const flow = await currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: flowId,
    })
    .throwIfNotFound()

  return await globalVariable({
    connection,
    app,
    flow,
    user: currentUser,
  })
}

const registerConnection: MutationResolvers['registerConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }
  const { connectionId, flowId } = input
  if (!flowId) {
    throw new BadUserInputError('Missing flowId')
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: flowId,
    })
    .throwIfNotFound()

  const connection = await getConnection({
    context,
    connectionId,
    flowId,
    includeOwnConnections: flow.role === 'owner',
  })

  if (!connection) {
    throw new BadUserInputError('Connection not found')
  }

  // GUARD: Prevent updating personal connections owned by others
  if (
    connection.userId !== null &&
    connection.userId !== context.currentUser.id
  ) {
    throw new ForbiddenError(
      'You cannot register a personal connection that you do not own',
    )
  }

  const app = apps[connection.key]
  if (!app) {
    throw new Error('Invalid app')
  }

  const auth = app.auth
  const connectionRegistrationType = auth?.connectionRegistrationType
  if (!auth || !connectionRegistrationType) {
    throw new Error('App does not support connection registration.')
  }

  const $ =
    connectionRegistrationType === 'global'
      ? await makeGlobalVariableForGlobalRegistration(
          context.currentUser,
          app,
          connection,
        )
      : await makeGlobalVariableForPerFlowRegistration(
          context.currentUser,
          app,
          connection,
          flowId,
        )

  if (!auth.isStillVerified) {
    throw new Error('App does not support connection verification')
  }
  const connectionStillVerified = await auth.isStillVerified($)
  if (!connectionStillVerified) {
    throw new Error('Connection is not verified')
  }

  await auth.registerConnection?.($)
  return true
}

export default registerConnection
