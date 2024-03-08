import { IFlowErrorConfig } from '@plumber/types'

import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    notificationFrequency: IFlowErrorConfig['notificationFrequency']
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

  return await flow.$query().patchAndFetch({
    config: {
      ...(flow.config ?? {}),
      errorConfig: {
        ...(flow.config?.errorConfig ?? {}),
        notificationFrequency: params.input.notificationFrequency,
      },
    },
  })
}

export default updateFlowConfig
