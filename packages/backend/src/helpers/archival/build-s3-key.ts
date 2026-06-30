export const S3_PREFIX_EXECUTIONS = 'executions'
export const S3_PREFIX_TEST_EXECUTIONS = 'test-executions'

export function buildS3Key(execution: {
  flowId: string
  id: string
  createdAt: string
  testRun: boolean
}): string {
  // Partition by SGT so re-hydration matches user-reported run times.
  // formatToParts extracts named fields directly, avoiding locale-separator assumptions.
  const sgtParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(execution.createdAt))
  const year = sgtParts.find((p) => p.type === 'year')!.value
  const month = sgtParts.find((p) => p.type === 'month')!.value
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
