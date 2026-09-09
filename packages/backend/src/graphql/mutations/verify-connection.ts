/**
 * TODO: remove this file and reuse test connection endpoint
 */

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const verifyConnection: NonNullable<
  MutationResolvers['verifyConnection']
> = async (_parent, params, context) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findById(input.flowId)
    .throwIfNotFound()

  let connection = await getConnection({
    context,
    connectionId: input.id,
    flowId: input.flowId,
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
      'You cannot update a personal connection that you do not own',
    )
  }

  const app = await App.findOneByKey(connection.key)
  const $ = await globalVariable({ connection, app, user: context.currentUser })

  if (!app.auth?.verifyCredentials) {
    throw new Error('App does not support credential verification')
  }
  await app.auth.verifyCredentials($)

  // First-time add still needs this write (verified starts false). Skip when
  // the row is already verified and not a draft so a later verify does not
  // bump updatedAt.
  if (connection.verified !== true || connection.draft !== false) {
    connection = await connection.$query().patchAndFetch({
      verified: true,
      draft: false,
    })
  }

  return {
    ...connection,
    app,
  }
}

export default verifyConnection
