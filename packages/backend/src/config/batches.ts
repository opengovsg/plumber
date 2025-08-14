import m365CreateTableRowTestBatchRun from '@/apps/m365-excel/actions/create-table-row/test-batch-run'
import { type ProcessedJobData } from '@/workers/helpers/process-batch-action-job'

/**
 * Assumptions before thinking of using batching for an action in an app:
 * - It should be using the same connection for all the jobs in the batch
 * - It has to have a queue to group similar jobs to batch e.g. app_action key
 *
 * To introduce batching to an action in an app:
 * 1. Add the app key to the QUEUE_BATCH_SIZE object
 * 2. Add the app_action key to the BATCH_FUNCTIONS object
 * 3. Add the queue settings to the queue/index.ts file
 * 4. Add the batchRun function in the specific action folder in the app. Take note that you should be try-catching the batching API call inside this function to avoid the entire batch from failing without any proper handling.
 * 5. Attach the batchRun function to this BATCH_RUN_FUNCTIONS object
 */

type BatchFunction = (jobsToProcessData: ProcessedJobData[]) => Promise<void>

const m365AppKey = 'm365-excel'
const m365CreateTableRowActionKey = 'createTableRow'

export const QUEUE_BATCH_SIZE = {
  [m365AppKey]: 5, // TODO: Update this upon discussions, this should be equal to the group limit concurrency
}

export const BATCH_RUN_FUNCTIONS: Record<string, BatchFunction> = {
  [`${m365AppKey}_${m365CreateTableRowActionKey}`]:
    m365CreateTableRowTestBatchRun, // TODO: Update this to the actual batch run function in next PR
}
