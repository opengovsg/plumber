import m365CreateTableRowBatchRun from '@/apps/m365-excel/actions/create-table-row/batch-run'
import { ProcessedJobData } from '@/services/batch-action'

/**
 * Assumptions before thinking of using batching for an action in an app:
 * - It should be using the same connection for all the jobs in the batch
 * - It has to have a queue to group similar jobs to batch e.g. app_action key
 *
 * To introduce batching to an action in an app:
 * 1. Add the app_action key to the BATCH_FUNCTIONS object
 * 2. Add the batchRun function in the specific action folder in the app. Take note that you should be try-catching the batching API call inside this function to avoid the entire batch from failing without any proper handling.
 * 3. Attach the batchRun function to this BATCH_RUN_FUNCTIONS object
 */

type BatchFunction = (jobsToProcessData: ProcessedJobData[]) => Promise<void>

const m365AppKey = 'm365-excel'
const m365CreateTableRowActionKey = 'createTableRow'

export const BATCH_RUN_FUNCTIONS: Record<string, BatchFunction> = {
  [`${m365AppKey}_${m365CreateTableRowActionKey}`]: m365CreateTableRowBatchRun,
}
