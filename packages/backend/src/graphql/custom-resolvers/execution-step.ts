import { TDataOutMetadata } from '@plumber/types'

import App from '@/models/app'
import ExecutionStep from '@/models/execution-step'

async function dataOutMetadata(
  parent: ExecutionStep,
): Promise<TDataOutMetadata> {
  const { appKey, key: stepKey } = await parent.$relatedQuery('step')
  if (!appKey || !stepKey) {
    return
  }
  const app = await App.findOneByKey(appKey)
  return await app.getDataOutMetadata?.(stepKey, parent)
}

export default {
  dataOutMetadata,
}
