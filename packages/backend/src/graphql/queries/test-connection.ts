import { ITestConnectionOutput } from '@plumber/types'

import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Context from '@/types/express/context'

type Params = {
  connectionId: string
  // when this is supplied, we check that the verify that the webhook url is properly set as well
  stepId?: string
}

const testConnection = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<ITestConnectionOutput> => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.connectionId,
    })
    .throwIfNotFound()

  const app = await App.findOneByKey(connection.key, false)
  let $ = await globalVariable({ connection, app })

  let step
  if (params.stepId) {
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

  const trigger = await step.getTriggerCommand()
  if (!trigger.verifyHook) {
    throw new Error('Verify webhook not implemented')
  }
  const { webhookVerified, message } = await trigger.verifyHook($)

  return {
    connectionVerified: isStillVerified,
    webhookVerified,
    message,
  }
}

export default testConnection
