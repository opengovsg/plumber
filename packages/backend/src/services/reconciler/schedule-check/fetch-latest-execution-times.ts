import Execution from '@/models/execution'

interface LatestExecutionRow {
  flowId: string
  latestCreatedAt: string | Date
}

export function buildLatestExecutionTimesQuery(flowIds: string[]) {
  return (
    Execution.query()
      // A soft-deleted execution still proves its run happened.
      .withSoftDeleted()
      .select('flow_id')
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

  const rows = (await buildLatestExecutionTimesQuery(
    flowIds,
  )) as unknown as LatestExecutionRow[]

  return new Map(
    rows.map((row) => [row.flowId, new Date(row.latestCreatedAt).getTime()]),
  )
}
