import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import App from '@/models/app'
import Context from '@/types/express/context'

type Params = {
  input: {
    connectionId: string
    stepId: string
  }
}

const registerWebhook = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { stepId, connectionId } = params.input
  const step = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched({
      connection: true,
      flow: true,
    })
    .findById(stepId)
    .throwIfNotFound()
  if (step.connectionId !== connectionId) {
    throw new Error('Connection does not match step')
  }

  const trigger = await step.getTriggerCommand()
  if (!trigger.registerHook) {
    throw new Error('Register webhook not implemented')
  }

  const app = await App.findOneByKey(step.appKey)
  const $ = await globalVariable({
    connection: step.connection,
    app,
    step,
    flow: step.flow,
    user: context.currentUser,
  })

  // Verify connection
  let isStillVerified
  try {
    isStillVerified = !!(await app.auth.isStillVerified($))
  } catch {
    throw new Error('Unable to verify connection')
  }
  if (!isStillVerified) {
    throw new Error('Connection is not verified')
  }

  // Register webhook
  try {
    await trigger.registerHook($)
  } catch (e) {
    logger.error('Unable to register webhook', e)
    throw new Error('Unable to register webhook')
  }

  return true
}

export default registerWebhook
