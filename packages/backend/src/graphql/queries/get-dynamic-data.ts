import { IDynamicData, IJSONObject } from '@plumber/types'

import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'
import Context from '@/types/express/context'

type Params = {
  stepId: string
  key: string
  parameters: IJSONObject
}

const getDynamicData = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { stepId, key: dynamicDataKey, parameters } = params

  const step = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched({
      connection: true,
      flow: true,
    })
    .findById(stepId)

  if (!step) {
    return null
  }

  const connection = step.connection

  if (!connection || !step.appKey) {
    return null
  }

  const app = apps[step.appKey]
  const $ = await globalVariable({
    connection,
    app,
    flow: step.flow,
    step,
    user: context.currentUser,
  })

  const command = app.dynamicData.find(
    (data: IDynamicData) => data.key === dynamicDataKey,
  )

  for (const parameterKey in parameters) {
    const parameterValue = parameters[parameterKey]
    $.step.parameters[parameterKey] = parameterValue
  }

  const fetchedData = await command.run($)

  if (fetchedData.error) {
    throw new Error(JSON.stringify(fetchedData.error))
  }

  return fetchedData.data
}

export default getDynamicData
