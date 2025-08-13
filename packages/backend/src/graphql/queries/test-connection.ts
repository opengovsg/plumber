import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import User from '@/models/user'

import type { QueryResolvers } from '../__generated__/types.generated'

const testConnection: QueryResolvers['testConnection'] = async (
  _parent,
  params,
  context,
) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      'connections.id': params.connectionId,
    })
    .throwIfNotFound()
  const userRole = connection.role

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

  if (params.flowId) {
    // flowId is supplied when testing within the pipe editor
    // it's used for formsg webhook verification for now
    const flow = await context.currentUser
      .withAccessibleFlows()
      .findById(params.flowId)
      .throwIfNotFound()

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
    logger.error(`Error verifying CONNECTION ID: ${params.connectionId}`, {
      event: 'test-connection',
      flowId: params.flowId,
      errMessage: err.message,
      errStack: err.stack,
    })
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: connection.formattedData,
    verified: isStillVerified,
  })

  // if testing outside of the editor, it does not verify registration (e.g. setting of webhook url)
  if (!isStillVerified || !params.flowId || userRole !== 'owner') {
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
