import apps from '@/apps'
import appConfig from '@/config/app'
import { appActionQueues, mainActionQueue } from '@/queues/action'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'

import logger from './logger'
import {
  computeDequeuingOk,
  computeEligibleWaiting,
} from './queue-depth-metrics-verdict'
import tracer from './tracer'

//
// Worker uptime SLI
// ---
// "Uptime" = workers are dequeuing jobs whenever there are jobs ready to run.
// We sample every queue on an interval (from the server process, so the
// observer is decoupled from worker health) and emit Datadog gauges via
// dd-trace's built-in dogstatsd client - no extra dependency.
//
// The primary signal is `plumber.worker.dequeuing_ok` (1 healthy / 0 outage):
// an outage is "there is eligible ready work but nothing is active". We
// deliberately subtract throttling so a healthy rate-limited worker is not
// flagged as down (see computeEligibleWaiting).
//

const SAMPLE_INTERVAL_MS = 30_000

// Minimal structural type covering both QueuePro<IActionJobData> (action
// queues) and the untyped flow/trigger QueuePro instances.
interface SampleableQueue {
  name: string
  getActiveCount(): Promise<number>
  getWaitingCount(): Promise<number>
  getDelayedCount(): Promise<number>
  getRateLimitTtl(): Promise<number>
  getGroupsCountByStatus(): Promise<{
    waiting: number
    limited: number
    maxed: number
    paused: number
  }>
}

interface QueueToSample {
  queue: SampleableQueue
  // Queue assigns jobs to groups (BullMQ-Pro groups) for some/all jobs.
  hasGroups: boolean
  // Queue declares a queue-level rate limiter (throttles the whole queue).
  hasQueueRateLimit: boolean
}

function getQueuesToSample(): QueueToSample[] {
  // Backbone queues - never grouped, never rate limited.
  const queues: QueueToSample[] = [
    { queue: flowQueue, hasGroups: false, hasQueueRateLimit: false },
    { queue: triggerQueue, hasGroups: false, hasQueueRateLimit: false },
    { queue: mainActionQueue, hasGroups: false, hasQueueRateLimit: false },
  ]

  // App-specific action queues - inspect each app's queue config to know
  // whether it groups jobs and/or applies a queue-level rate limit.
  for (const [appKey, queue] of Object.entries(appActionQueues)) {
    const queueConfig = apps[appKey]?.queue
    queues.push({
      queue,
      hasGroups: Boolean(queueConfig?.getGroupConfigForJob),
      hasQueueRateLimit: Boolean(queueConfig?.queueRateLimit),
    })
  }

  return queues
}

async function sampleQueue({
  queue,
  hasGroups,
  hasQueueRateLimit,
}: QueueToSample): Promise<void> {
  const tags = { queue: queue.name }

  const [activeCount, waitingCount, delayedCount] = await Promise.all([
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getDelayedCount(),
  ])

  // Only query throttle/group state when the queue actually uses them - saves
  // Redis round trips on the backbone queues and keeps custom metrics meaningful.
  const rateLimitTtlMs = hasQueueRateLimit ? await queue.getRateLimitTtl() : -1
  const groups = hasGroups ? await queue.getGroupsCountByStatus() : null

  const eligibleWaiting = computeEligibleWaiting({
    rateLimitTtlMs,
    waitingCount,
    readyGroupCount: groups?.waiting ?? 0,
  })
  const dequeuingOk = computeDequeuingOk(activeCount, eligibleWaiting)

  // Primary SLI gauge.
  tracer.dogstatsd.gauge('plumber.worker.dequeuing_ok', dequeuingOk, tags)

  // Raw components for dashboards / root-cause.
  tracer.dogstatsd.gauge('plumber.queue.active', activeCount, tags)
  tracer.dogstatsd.gauge('plumber.queue.waiting', waitingCount, tags)
  tracer.dogstatsd.gauge('plumber.queue.delayed', delayedCount, tags)

  if (hasQueueRateLimit) {
    tracer.dogstatsd.gauge(
      'plumber.queue.rate_limit_ttl',
      Math.max(rateLimitTtlMs, 0),
      tags,
    )
  }

  if (groups) {
    tracer.dogstatsd.gauge('plumber.queue.groups.waiting', groups.waiting, tags)
    tracer.dogstatsd.gauge('plumber.queue.groups.limited', groups.limited, tags)
    tracer.dogstatsd.gauge('plumber.queue.groups.maxed', groups.maxed, tags)
    tracer.dogstatsd.gauge('plumber.queue.groups.paused', groups.paused, tags)
  }
}

export function startQueueDepthMetrics(): void {
  // No Datadog agent locally; emitting is pointless noise.
  if (appConfig.isDev) {
    return
  }

  const queues = getQueuesToSample()

  const interval = setInterval(() => {
    void (async () => {
      for (const queueToSample of queues) {
        try {
          await sampleQueue(queueToSample)
        } catch (err) {
          // A Redis hiccup on one queue must not crash the loop or skew the
          // SLI - skip this queue for this tick rather than emitting a 0.
          logger.error('Failed to sample queue depth', {
            queue: queueToSample.queue.name,
            err: (err as Error).stack,
          })
        }
      }
    })()
  }, SAMPLE_INTERVAL_MS)

  // Never let the sampler keep the process alive.
  interval.unref()
  process.on('SIGTERM', () => clearInterval(interval))

  logger.info('Queue depth metrics sampler started')
}
