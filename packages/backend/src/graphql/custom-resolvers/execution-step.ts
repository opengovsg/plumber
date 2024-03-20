import App from '@/models/app'

import type { Resolvers } from '../__generated__/types.generated'

type ExecutionStepResolver = Resolvers['ExecutionStep']

const dataOutMetadata: ExecutionStepResolver['dataOutMetadata'] = async (
  parent,
) => {
  const {
    appKey,
    key: stepKey,
    isAction,
    isTrigger,
  } = await parent.$relatedQuery('step')
  if (!appKey || !stepKey) {
    return
  }

  const app = await App.findOneByKey(appKey)

  if (isAction) {
    const action = app?.actions?.find((action) => action.key === stepKey)
    return (await action?.getDataOutMetadata?.(parent)) ?? null
  }

  if (isTrigger) {
    const trigger = app?.triggers?.find((trigger) => trigger.key === stepKey)
    return (await trigger?.getDataOutMetadata?.(parent)) ?? null
  }

  return null
}

export default {
  dataOutMetadata,
} satisfies Resolvers['ExecutionStep']
