import type { IAppQueue } from '@plumber/types'

import { M365_EXCEL_DELAY_BETWEEN_ACTIONS_MS } from '@/config/app-env-vars/m365'
import Step from '@/models/step'

//
// This config sets up a per-app queue to serialize Excel actions by file, as
// per guidelines from Microsoft.
// https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#throttling-and-concurrency
//
// It also configures the queue to dispense actions using a leaky bucket
// approach, at a rate that will satisfy the rate limits imposed on us.
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

  // NOTE: File ID is only unique within the same SharePoint site and tenant.
  // But since we only have one site per tenant, and we need a different per-app
  // queue for each tenant (each tenant may have different agreed-upon rate
  // limits), we can avoid compleixty and simply set group ID to the file ID,
  // instead of something like `${tenantId}-${siteId}-${fileId}`.
  //
  // (The one app-queue per tenant thing isn't implemnented yet - for now, each
  // app can only have 1 per-app queue. We'll only do this if we ever need to
  // support more than 1 tenant.)
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
  isQueueDelayable: true,
  queueRateLimit: {
    max: 1,
    duration: M365_EXCEL_DELAY_BETWEEN_ACTIONS_MS,
  },
} satisfies IAppQueue

export default queueSettings
