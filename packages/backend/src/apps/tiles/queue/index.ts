import type { IAppQueue } from '@plumber/types'

import Step from '@/models/step'
import TableMetadata from '@/models/table-metadata'
import { isTileMigrating } from '@/models/tiles/migration/lease'

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

const WRITE_ACTIONS = new Set(['createTileRow', 'updateSingleRow'])
const MIGRATING_REQUEUE_MIN_DELAY_MS = 60_000
const MIGRATING_REQUEUE_JITTER_MS = 30_000

// Writes to a tile frozen for migration wait in the queue. Reads never wait.
const getRequeueDelayMs: IAppQueue['getRequeueDelayMs'] = async ($) => {
  if (!WRITE_ACTIONS.has($.step.key)) {
    return null
  }
  const table = await TableMetadata.query().findById(
    $.step.parameters.tableId as string,
  )
  if (!table || !isTileMigrating(table)) {
    return null
  }
  // Jitter spreads the re-checks when a freeze lifts.
  return (
    MIGRATING_REQUEUE_MIN_DELAY_MS +
    Math.floor(Math.random() * MIGRATING_REQUEUE_JITTER_MS)
  )
}

const queueSettings = {
  getGroupConfigForJob,
  getRequeueDelayMs,
  groupLimits: {
    type: 'concurrency',
    concurrency: 1,
  },
  isQueueDelayable: false,
  workerType: 'action',
} satisfies IAppQueue

export default queueSettings
