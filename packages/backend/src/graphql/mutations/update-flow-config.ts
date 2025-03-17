import type { IFlowConfig, IFlowErrorConfig } from '@plumber/types'

import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    notificationFrequency: IFlowErrorConfig['notificationFrequency']
    showSurvey: boolean
  }
}

const updateFlowConfig = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  const newConfig: IFlowConfig = {
    ...flow.config,
  }

  if (params.input.notificationFrequency !== undefined) {
    newConfig.errorConfig = {
      ...newConfig.errorConfig, // If ever undefined (should never be), it gets set to an empty object first
      notificationFrequency: params.input.notificationFrequency,
    }
  }

  if (params.input.showSurvey !== undefined) {
    newConfig.showSurvey = params.input.showSurvey
  }

  return await flow.$query().patchAndFetch({
    config: newConfig,
  })
}

export default updateFlowConfig
