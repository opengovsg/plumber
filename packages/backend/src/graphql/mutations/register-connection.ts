import type { IApp, IGlobalVariable } from '@plumber/types'

import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'
import type Connection from '@/models/connection'
import type User from '@/models/user'
import type Context from '@/types/express/context'

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

async function makeGlobalVariableForPerStepRegistration(
  currentUser: User,
  app: IApp,
  connection: Connection,
  stepId: string,
): Promise<IGlobalVariable> {
  const step = await currentUser
    .$relatedQuery('steps')
    .withGraphFetched({
      connection: true,
      flow: true,
    })
    .findById(stepId)
    .throwIfNotFound()
  if (step.connectionId !== connection.id) {
    throw new Error('Connection does not match step')
  }

  return await globalVariable({
    connection,
    app,
    step,
    flow: step.flow,
    user: currentUser,
  })
}

type Params = {
  input: {
    connectionId: string
    stepId: string | null
  }
}

const registerConnection = async function (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<boolean> {
  const { connectionId, stepId } = params.input

  const connection = await context.currentUser
    .$relatedQuery('connections')
    .findById(connectionId)
    .throwIfNotFound()

  const app = apps[connection.key]
  if (!app) {
    throw new Error('Invalid app')
  }

  const connectionRegistrationType = app.auth?.connectionRegistrationType
  if (!connectionRegistrationType) {
    throw new Error('App does not support connection registration.')
  }

  const $ =
    connectionRegistrationType === 'global'
      ? await makeGlobalVariableForGlobalRegistration(
          context.currentUser,
          app,
          connection,
        )
      : await makeGlobalVariableForPerStepRegistration(
          context.currentUser,
          app,
          connection,
          stepId,
        )

  const connectionStillVerified = await app.auth.isStillVerified($)
  if (!connectionStillVerified) {
    throw new Error('Connection is not verified')
  }

  await app.auth.registerConnection($)
  return true
}

export default registerConnection
