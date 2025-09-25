import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'

import type { QueryResolvers } from '../__generated__/types.generated'

const getDynamicData: QueryResolvers['getDynamicData'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, key: dynamicDataKey, parameters } = params

  const step = await context.currentUser
    .withAccessible({ type: 'step', requiredRole: 'viewer' })
    .withGraphFetched({
      connection: true,
      flow: {
        user: true,
        collaborators: {
          user: true,
        },
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

  const command = app.dynamicData.find((data) => data.key === dynamicDataKey)

  for (const parameterKey in parameters) {
    const parameterValue = parameters[parameterKey]
    $.step.parameters[parameterKey] = parameterValue
  }

  const fetchedData = await command.run($)
  // TODO (kevinkim-ogp): should filter out data that is not accessible to the user

  if (fetchedData.error) {
    throw new Error(JSON.stringify(fetchedData.error))
  }

  return fetchedData.data
}

export default getDynamicData
