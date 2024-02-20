import { type NotificationFrequency } from '@/models/flow'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    notificationFrequency: NotificationFrequency
  }
}

const updateFlowConfig = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  let flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  flow = await flow.$query().patchAndFetch({
    config: {
      errorConfig: {
        notificationFrequency: params.input.notificationFrequency,
      },
    },
  })

  return flow
}

export default updateFlowConfig
