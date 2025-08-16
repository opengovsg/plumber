import type { IAppQueue } from '@plumber/types'

import { M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS } from '@/config/app-env-vars/m365'
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
  const tableId = step.parameters['tableId'] as string

  if (!tableId) {
    throw new Error(
      `Expected tableId to be non-empty for step ${jobData.stepId}`,
    )
  }

  // NOTE: Table ID is only unique within the same SharePoint site and tenant.
  // But since we only have one site per tenant, and we need a different per-app
  // queue for each tenant (each tenant may have different agreed-upon rate
  // limits), we can avoid complexity and simply set group ID to the table ID,
  // instead of something like `${tenantId}-${siteId}-${tableId}`.
  //
  // (The one app-queue per tenant thing isn't implemented yet - for now, each
  // app can only have 1 per-app queue. We'll only do this if we ever need to
  // support more than 1 tenant.)
  //
  // The format will be: `${appKey}_${actionKey}_${tableId}` e.g. `m365-excel_createTableRow_1234567890`
  return {
    id: `${step.appKey}_${step.key}_${tableId}`,
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
    duration: M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS,
  },
} satisfies IAppQueue

export default queueSettings
