import { client as knexClient } from '@/config/database'

interface LatestExecutionRow {
  flow_id: string
  latest_created_at: string | Date
}

// Not the Execution model: it imports every app, and some apps open Redis clients at import.
export function buildLatestExecutionTimesQuery(flowIds: string[]) {
  return (
    knexClient('executions')
      // A soft-deleted execution still proves its run happened.
      .select<LatestExecutionRow[]>('flow_id')
      .max('created_at as latest_created_at')
      .whereIn('flow_id', flowIds)
      .where('test_run', false)
      .groupBy('flow_id')
  )
}

export async function fetchLatestExecutionTimes(
  flowIds: string[],
): Promise<Map<string, number>> {
  if (flowIds.length === 0) {
    return new Map()
  }

  const rows = await buildLatestExecutionTimesQuery(flowIds)

  return new Map(
    rows.map((row) => [row.flow_id, new Date(row.latest_created_at).getTime()]),
  )
}
