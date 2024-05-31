import type { IAppQueue } from '@plumber/types'

import { postmanSmsConfig } from '@/config/app-env-vars/postman-sms'

// We need to rate limit by API key (i.e. connection ID) when we eventually
// implement the functionality for users to add their own connections /
// campaigns / templates.
//
// However, we currently force all users to go through Plumber's API key. Hence
// we just put a fixed placeholder for group ID.
const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async () => {
  return {
    id: 'placeholder-plumber-api-key',
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
