import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'

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

  let step
  if (params.stepId) {
    // when stepId is supplied, we check that the verify that the webhook url is
    // properly set as well
    step = await context.currentUser
      .$relatedQuery('steps')
      .withGraphFetched({
        connection: true,
        flow: true,
      })
      .findById(params.stepId)
      .throwIfNotFound()
    if (step.connectionId !== params.connectionId) {
      throw new Error('Connection does not match step')
    }

    $ = await globalVariable({
      connection,
      app,
      step,
      flow: step.flow,
      user: context.currentUser,
    })
  }

  // Verify connection
  let isStillVerified
  try {
    isStillVerified = !!(await app.auth.isStillVerified($))
  } catch {
    isStillVerified = false
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: connection.formattedData,
    verified: isStillVerified,
  })

  if (!isStillVerified || !params.stepId) {
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
