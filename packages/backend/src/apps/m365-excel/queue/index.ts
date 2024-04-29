import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

//
// This config sets up a queue to serialize excel actions by file, as per
// guidelines from Microsoft.
// https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#throttling-and-concurrency
//

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()
  const fileId = step.parameters['fileId'] as string

  if (!fileId) {
    throw new Error(
      `Expected fileId to be non-empty for step ${jobData.stepId}`,
    )
  }

  return {
    id: fileId,
  }
}

const queueSettings = {
  getGroupConfigForJob,
  groupLimits: {
    type: 'concurrency',
    concurrency: 1,
  },
  isQueuePausable: true,
} satisfies IAppQueue

export default queueSettings
