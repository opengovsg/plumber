export const S3_PREFIX_EXECUTIONS = 'executions'
export const S3_PREFIX_TEST_EXECUTIONS = 'test-executions'

export function buildS3Key(execution: {
  flowId: string
  id: string
  createdAt: string
  testRun: boolean
}): string {
  const date = new Date(execution.createdAt)
  const prefix = execution.testRun
    ? S3_PREFIX_TEST_EXECUTIONS
    : S3_PREFIX_EXECUTIONS
  return [
    prefix,
    `flow_id=${execution.flowId}`,
    `year=${date.getUTCFullYear()}`,
    `month=${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    `execution_id=${execution.id}.json.gz`,
  ].join('/')
}
