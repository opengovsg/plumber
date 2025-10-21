import apps from '@/apps'
import { ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import User from '@/models/user'
import { getConnection } from '@/services/connection'

import type { QueryResolvers } from '../__generated__/types.generated'

const testConnection: QueryResolvers['testConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, connectionId, supportsConnectionRegistration } = params
  let connection
  let flow
  let userRole

  if (flowId) {
    // flowId is only provided when testing connection from the pipe editor
    // check if user has access to the flow first
    flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .findById(flowId)

    if (!flow) {
      throw new ForbiddenError(
        'You do not have sufficient permissions for this pipe',
      )
    }

    userRole = flow.role

    connection = await getConnection({
      context,
      connectionId: params.connectionId,
      flowId: params.flowId,
      includeOwnConnections: userRole === 'owner',
    })
  } else {
    // if flowId is undefined, it is always the owner's connections
    // as we testing from the My Apps page
    connection = await context.currentUser
      .$relatedQuery('connections')
      .findOne({ id: connectionId })
      .throwIfNotFound()
    userRole = 'owner'
  }

  const app = apps[connection.key]
  let $ = await globalVariable({
    connection,
    app,
    user:
      userRole === 'owner'
        ? context.currentUser
        : await User.query().findOne({
            id: connection.userId,
          }),
  })

  if (flowId) {
    $ = await globalVariable({
      connection,
      app,
      flow,
      user: context.currentUser,
    })
  }

  // Verify connection
  let isStillVerified
  let errorMessage
  try {
    isStillVerified = !!(await app.auth.isStillVerified($))
  } catch (err) {
    isStillVerified = false
    errorMessage = err.message
    logger.error(`Error verifying CONNECTION ID: ${connectionId}`, {
      event: 'test-connection',
      flowId: flowId,
      errMessage: err.message,
      errStack: err.stack,
    })
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: connection.formattedData,
    verified: isStillVerified,
  })

  // if testing outside of the editor, it does not verify registration (e.g. setting of webhook url)
  if (!isStillVerified || !flowId || !supportsConnectionRegistration) {
    return { connectionVerified: isStillVerified, message: errorMessage }
  }

  // TODO (ogp-weeloong): We should actually _disallow_ testing connections
  // from outside the pipe editor if app needs per-step connection registration.
  if (!app.auth?.verifyConnectionRegistration) {
    throw new Error('Connection registration verification not implemented')
  }
  const { registrationVerified, message } =
    await app.auth.verifyConnectionRegistration($)

  return {
    connectionVerified: isStillVerified,
    registrationVerified,
    message,
  }
}

export default testConnection
