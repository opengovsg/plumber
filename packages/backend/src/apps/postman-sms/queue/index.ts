import type { IAppQueue } from '@plumber/types'

import { postmanSmsConfig } from '@/config/app-env-vars/postman-sms'
import Step from '@/models/step'

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async ({
  stepId,
}) => {
  const step = await Step.query().findById(stepId).throwIfNotFound()

  return {
    // Each connection ID should, _in theory_, represent a different campaign.
    //
    // Users might think they can get around this rate limit by creating
    // duplicate connections for the same campaign, but they'll just get slapped
    // with a 429 from postman.
    //
    // When we have time we might close this footgun by building a
    // connection_metadata column or similar :/
    id: step.connectionId,
  }
}

const queueSettings = {
  getGroupConfigForJob,
  groupLimits: {
    type: 'rate-limit',
    limit: {
      max: postmanSmsConfig.qpsLimitPerCampaign,
      duration: 1000,
    },
  },
  isQueueDelayable: false,
} satisfies IAppQueue

export default queueSettings
