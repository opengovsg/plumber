export function buildS3Key(execution: {
  flowId: string
  id: string
  createdAt: Date | string
}): string {
  const date = new Date(execution.createdAt)
  return [
    `flow_id=${execution.flowId}`,
    `year=${date.getUTCFullYear()}`,
    `month=${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    `execution_id=${execution.id}.json.gz`,
  ].join('/')
}
