import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'

//
// This config sets up a per-app queue to serialize Excel actions by file, as
// per guidelines from Microsoft.
// https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#throttling-and-concurrency
//
// It also configures the queue to hit ~1 action per 0.576 seconds using a leaky
// bucket approach, because that satifies the rate limits we're subject to:
//
// - Microsoft Graph limit: 13000 queries per 10s
// - SharePoint limit 1: 300 per min (60s)
// - [** MINIMUM **] SharePoint limit 2: 300k per day (86400s)
// - Excel limit: 150 per 10s
//
// We average around 2 queries per Excel action (check file sensitivity + the
// actual Excel operation), so we target around (300k / 2) / 86400 actions per
// second, which is 1 action per ~0.576 seconds.
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
  isQueuePausable: true,
  queueRateLimit: {
    max: 1,
    duration: 576,
  },
} satisfies IAppQueue

export default queueSettings
