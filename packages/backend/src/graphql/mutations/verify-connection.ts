/**
 * TODO: remove this file and reuse test connection endpoint
 */

import { ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const verifyConnection: MutationResolvers['verifyConnection'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findById(params.input.flowId)
    .throwIfNotFound()

  let connection = await getConnection({
    context,
    connectionId: params.input.id,
    flowId: params.input.flowId,
    includeOwnConnections: flow.role === 'owner',
  })

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
