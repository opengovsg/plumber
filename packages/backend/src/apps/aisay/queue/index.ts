import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()

  /**
   * This config sets up a per-AISAY connection queue, i.e., all AISAY actions
   * that use the same AISAY connection are grouped together and rate limited.
   * This is a conservative approach to start with and can be tweaked later.
   */
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
  isQueueDelayable: false,
} satisfies IAppQueue

export default queueSettings
