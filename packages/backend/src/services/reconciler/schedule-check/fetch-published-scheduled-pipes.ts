import type { IJSONObject } from '@plumber/types'

import schedulerApp from '@/apps/scheduler'
import { client as knexClient } from '@/config/database'

export interface PublishedScheduledPipe {
  flowId: string
  publishedAt: string
  triggerKey: string
  triggerParameters: IJSONObject
}

interface PublishedScheduledPipeRow {
  flow_id: string
  published_at: string
  key: string
  parameters: IJSONObject
}

// Not the Step model: it imports every app, and some apps open Redis clients at import.
export function buildPublishedScheduledPipesQuery() {
  return knexClient('steps')
    .join('flows', 'flows.id', 'steps.flow_id')
    .select<PublishedScheduledPipeRow[]>(
      'steps.flow_id',
      'steps.key',
      'steps.parameters',
      'flows.published_at',
    )
    .whereNull('steps.deleted_at')
    .whereNull('flows.deleted_at')
    .where('flows.active', true)
    .where('steps.type', 'trigger')
    .where('steps.app_key', schedulerApp.key)
    .whereIn(
      'steps.key',
      schedulerApp.triggers.map((trigger) => trigger.key),
    )
}

export async function fetchPublishedScheduledPipes(): Promise<
  PublishedScheduledPipe[]
> {
  const rows = await buildPublishedScheduledPipesQuery()

  return rows.map((row) => ({
    flowId: row.flow_id,
    publishedAt: row.published_at,
    triggerKey: row.key,
    triggerParameters: row.parameters,
  }))
}
