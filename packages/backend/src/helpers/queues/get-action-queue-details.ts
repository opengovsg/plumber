// Naming convention a little different for legacy reasons.
const DEFAULT_REDIS_CONNECTION_PREFIX = '{actionQ}'
const DEFAULT_ACTION_QUEUE_NAME = 'action'

interface QueueDetails {
  queueName: string
  redisConnectionPrefix: string
}

// leave appKey undefined to get details for default queue.
export function getActionQueueDetails(appKey?: string): QueueDetails {
  const queueName = appKey
    ? `{app-actions-${appKey}}`
    : DEFAULT_ACTION_QUEUE_NAME

  // Prefix only needed for the legacy action queue; we directly wrap the queue
  // name with curly braces for new queues.
  // https://docs.bullmq.io/bull/patterns/redis-cluster
  const redisConnectionPrefix = appKey ? null : DEFAULT_REDIS_CONNECTION_PREFIX

  return { queueName, redisConnectionPrefix }
}
