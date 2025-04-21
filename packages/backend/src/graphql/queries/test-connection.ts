import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'

import type { QueryResolvers } from '../__generated__/types.generated'

const testConnection: QueryResolvers['testConnection'] = async (
  _parent,
  params,
  context,
) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.connectionId,
    })
    .throwIfNotFound()

  const app = apps[connection.key]
  let $ = await globalVariable({ connection, app })

  if (params.flowId) {
    // flowId is supplied when testing within the pipe editor
    // it's used for formsg webhook verification for now
    const flow = await context.currentUser
      .$relatedQuery('flows')
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
  try {
    isStillVerified = !!(await app.auth.isStillVerified($))
  } catch (err) {
    isStillVerified = false
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
  if (!isStillVerified || !params.flowId) {
    return { connectionVerified: isStillVerified }
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
