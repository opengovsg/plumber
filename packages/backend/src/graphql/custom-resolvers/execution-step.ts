import { IDataOutMetadata } from '@plumber/types'

import App from '@/models/app'
import ExecutionStep from '@/models/execution-step'

async function dataOutMetadata(
  parent: ExecutionStep,
): Promise<IDataOutMetadata> {
  const { appKey, key: stepKey } = await parent.$relatedQuery('step')
  if (!appKey || !stepKey) {
    return
  }
  const app = await App.findOneByKey(appKey)

  const action = app.actions?.find((action) => action.key === stepKey)
  if (action) {
    return action.getDataOutMetadata?.(parent)
  }

  const trigger = app.triggers?.find((trigger) => trigger.key === stepKey)
  return await trigger?.getDataOutMetadata?.(parent)
}

export default {
  dataOutMetadata,
}
