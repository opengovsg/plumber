import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()

  return {
    id: step.connectionId,
  }
}

const queueSettings = {
  getGroupConfigForJob,
  groupLimits: {
    type: 'concurrency',
    concurrency: 1,
  },
  queueRateLimit: {
    max: 2,
    duration: 1000,
  },
  isQueueDelayable: false,
  workerType: 'action',
} satisfies IAppQueue

export default queueSettings
