import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

// Rate limit each connection to 80 actions-ish per 5 minutes, spread evenly
const MAX_ACTIONS = 80
const WINDOW_MS = 5 * 60 * 1000 // 5 min
const ACTION_INTERVAL_MS = Math.ceil(WINDOW_MS / MAX_ACTIONS)

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async ({
  stepId,
}) => {
  const step = await Step.query().findById(stepId).throwIfNotFound()

  return {
    id: step.connectionId,
  }
}

const queueSettings = {
  getGroupConfigForJob,
  groupLimits: {
    type: 'rate-limit',
    limit: {
      max: 1,
      duration: ACTION_INTERVAL_MS,
    },
  },
  isQueueDelayable: false,
  workerType: 'action',
} satisfies IAppQueue

export default queueSettings
