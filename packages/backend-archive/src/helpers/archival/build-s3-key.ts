import '@/types/luxon-extensions'

import { DateTime } from 'luxon'

export const S3_PREFIX_EXECUTIONS = 'executions'
export const S3_PREFIX_TEST_EXECUTIONS = 'test-executions'

export function buildS3Key(execution: {
  flowId: string
  id: string
  createdAt: Date | string
  testRun: boolean
}): string {
  // Partition by SGT so re-hydration matches user-reported run times.
  // pg returns TIMESTAMP columns as Date objects; handle both Date and string.
  const sgt = DateTime.fromJSDate(
    execution.createdAt instanceof Date
      ? execution.createdAt
      : new Date(execution.createdAt),
  )
  const year = sgt.toPlumberFormat('yyyy')
  const month = sgt.toPlumberFormat('MM')
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
