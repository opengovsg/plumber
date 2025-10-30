import { IDynamicAction } from '@plumber/types'

import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'

import type { MutationResolvers } from '../__generated__/types.generated'

const dynamicAction: MutationResolvers['dynamicAction'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, key: dynamicActionKey, parameters } = params.input

  const step = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched({
      connection: true,
      flow: {
        user: true,
      },
    })
    .findById(stepId)

  if (!step || !step.appKey) {
    return null
  }

  const app = apps[step.appKey]
  const connection = step.connection

  // if app requires connection, only proceed if connection has been set up
  if (app.auth && !connection) {
    return null
  }

  const $ = await globalVariable({
    connection,
    app,
    flow: step.flow,
    step,
    user: context.currentUser,
  })

  const command = app.dynamicData.find(
    (data) => data.key === dynamicActionKey,
  ) as IDynamicAction | undefined

  if (!command || command.type !== 'action') {
    throw new Error(`Dynamic action ${dynamicActionKey} not found`)
  }

  for (const parameterKey in parameters) {
    const parameterValue = parameters[parameterKey]
    $.step.parameters[parameterKey] = parameterValue
  }

  const fetchedData = await command.run($)

  return fetchedData
}

export default dynamicAction
