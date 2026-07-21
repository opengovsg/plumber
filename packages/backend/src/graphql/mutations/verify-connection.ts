/**
 * TODO: remove this file and reuse test connection endpoint
 */

import { ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Connection from '@/models/connection'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const verifyConnection: MutationResolvers['verifyConnection'] = async (
  _parent,
  params,
  context,
) => {
  let connection
  if (params.input.flowId) {
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'editor' })
      .findById(params.input.flowId)
      .throwIfNotFound()

    connection = await getConnection({
      context,
      connectionId: params.input.id,
      flowId: params.input.flowId,
      includeOwnConnections: flow.role === 'owner',
    })
  } else {
    // The AI Builder verifies connections created before any pipe exists —
    // without a flowId only the user's own personal connections are reachable.
    connection = await Connection.query()
      .findById(params.input.id)
      .where('user_id', context.currentUser.id)
      .throwIfNotFound({ message: 'Connection not found' })
  }

  // GUARD: Prevent updating personal connections owned by others
  if (
    connection.userId !== null &&
    connection.userId !== context.currentUser.id
  ) {
    throw new ForbiddenError(
      'You cannot update a personal connection that you do not own',
    )
  }

  const app = await App.findOneByKey(connection.key)
  const $ = await globalVariable({ connection, app, user: context.currentUser })

  await app.auth.verifyCredentials($)

  connection = await connection.$query().patchAndFetch({
    verified: true,
    draft: false,
  })

  return {
    ...connection,
    app,
  }
}

export default verifyConnection
