import type { IAppQueue } from '@plumber/types'

import { postmanSmsConfig } from '@/config/app-env-vars/postman-sms'
import Flow from '@/models/flow'

import { getCampaignForUser } from '../common/get-campaign-for-user'

// We need to rate limit by API key (i.e. connection ID) when we eventually
// implement the functionality for users to add their own connections /
// campaigns / templates.
//
// However, we currently force all users to go through Plumber's campaigns, so
// we set the group ID to our campaign ID instead.
const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async ({
  flowId,
}) => {
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphJoined({ user: true })
    .throwIfNotFound()
  const { campaignId } = await getCampaignForUser(flow.user.email)

  return {
    id: campaignId,
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
