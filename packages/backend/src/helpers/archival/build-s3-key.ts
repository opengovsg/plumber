import { DateTime } from 'luxon'

export const S3_PREFIX_EXECUTIONS = 'executions'
export const S3_PREFIX_TEST_EXECUTIONS = 'test-executions'

export function buildS3Key(execution: {
  flowId: string
  id: string
  createdAt: string
  testRun: boolean
}): string {
  // Partition by SGT so re-hydration matches user-reported run times.
  // Luxon's defaultZone is Asia/Singapore (see config/app.ts), so fromISO
  // automatically converts to SGT.
  const dt = DateTime.fromISO(execution.createdAt)
  const year = String(dt.year)
  const month = String(dt.month).padStart(2, '0')
  const prefix = execution.testRun
    ? S3_PREFIX_TEST_EXECUTIONS
    : S3_PREFIX_EXECUTIONS
  return [
    prefix,
    `flow_id=${execution.flowId}`,
    `year=${year}`,
    `month=${month}`,
    `execution_id=${execution.id}.json.gz`,
  ].join('/')
}
