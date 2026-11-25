import BaseExecution from '@/models/execution/base'

interface LatestExecutionRow {
  flowId: string
  latestCreatedAt: string | Date
}

// BaseExecution, not Execution: Execution imports every app, and some apps open Redis clients at import.
export function buildLatestExecutionTimesQuery(
  flowIds: string[],
  sinceMillis: number,
) {
  return (
    BaseExecution.query()
      // A soft-deleted execution still proves its run happened.
      .withSoftDeleted()
      .select('flow_id')
      .max('created_at as latest_created_at')
      .whereIn('flow_id', flowIds)
      .where('test_run', false)
      // The max reads every matching row, so an unbounded scan grows with each pipe's history.
      .where('created_at', '>=', new Date(sinceMillis))
      .groupBy('flow_id')
      .castTo<LatestExecutionRow[]>()
  )
}

export async function fetchLatestExecutionTimes(
  flowIds: string[],
  sinceMillis: number,
): Promise<Map<string, number>> {
  if (flowIds.length === 0) {
    return new Map()
  }

  const rows = await buildLatestExecutionTimesQuery(flowIds, sinceMillis)

  return new Map(
    rows.map((row) => [row.flowId, new Date(row.latestCreatedAt).getTime()]),
  )
}
