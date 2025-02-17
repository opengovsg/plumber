import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

// Define actions that should be queued
const QUEUED_ACTIONS = new Set(['findSingleRow'])

//
// This config sets up a per-Tile findSingleRow action queue, i.e., only findSingleRow
// actions are grouped and rate limited.
// All other Tile actions are not grouped and do not need to be rate limited.
//
// This is necessary because the findSingleRow action is the most expensive
// operation in the Tile app, due to the need to scan the entire DynamoDB table.
//

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()
  const tableId = step.parameters['tableId'] as string

  if (QUEUED_ACTIONS.has(step.key)) {
    return {
      id: `${tableId}-${step.key}`,
    }
  }

  // All other Tile actions are not grouped and do not need to be rate limited
  // as the write operations are fast and less expensive.
  return null
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
