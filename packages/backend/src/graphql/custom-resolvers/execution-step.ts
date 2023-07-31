import { IDataOutMetadata } from '@plumber/types'

import App from '@/models/app'
import ExecutionStep from '@/models/execution-step'

async function dataOutMetadata(
  parent: ExecutionStep,
): Promise<IDataOutMetadata | null> {
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
    console.log('action execution step')
    console.log(action)
    return (await action?.getDataOutMetadata?.(parent)) ?? null
  }

  if (isTrigger) {
    const trigger = app?.triggers?.find((trigger) => trigger.key === stepKey)
    console.log('trigger execution step')
    console.log(trigger)
    return (await trigger?.getDataOutMetadata?.(parent)) ?? null
  }

  return null
}

export default {
  dataOutMetadata,
}
