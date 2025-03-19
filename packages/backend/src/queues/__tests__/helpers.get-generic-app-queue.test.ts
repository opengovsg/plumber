import { describe, expect, it } from 'vitest'

import { QUEUE_CONCURRENCY } from '@/config/queues'

import { getGenericAppQueue } from '../helpers/get-generic-app-queue'

describe('tests for apps with generic queue', () => {
  // apps that have a generic queue
  const apps = Object.keys(QUEUE_CONCURRENCY)

  it.each(apps)(
    'should return a generic queue with the correct group config for %s',
    async (app) => {
      const appKey = app as keyof typeof QUEUE_CONCURRENCY
      const queue = getGenericAppQueue(appKey)
      const groupConfig = await queue.getGroupConfigForJob({
        flowId: 'some-flow-id',
        executionId: 'some-execution-id',
        stepId: 'some-step-id',
      })
      expect(groupConfig).toEqual({ id: app })
    },
  )

  it.each(apps)(
    'should return a generic queue with the correct concurrency for %s',
    (app) => {
      const appKey = app as keyof typeof QUEUE_CONCURRENCY
      const queue = getGenericAppQueue(appKey)
      expect(queue.groupLimits.type).toBe('concurrency')
      if (queue.groupLimits.type === 'concurrency') {
        expect(queue.groupLimits.concurrency).toBe(QUEUE_CONCURRENCY[appKey])
      }
    },
  )

  it('should return a generic queue with concurrency 2 if the app is not in the QUEUE_CONCURRENCY object', async () => {
    const queue = getGenericAppQueue(
      'NOT_A_REAL_APP' as keyof typeof QUEUE_CONCURRENCY,
    )
    const groupConfig = await queue.getGroupConfigForJob({
      flowId: 'some-flow-id',
      executionId: 'some-execution-id',
      stepId: 'some-step-id',
    })
    expect(groupConfig).toEqual({ id: 'NOT_A_REAL_APP' })

    expect(queue.groupLimits.type).toBe('concurrency')
    if (queue.groupLimits.type === 'concurrency') {
      expect(queue.groupLimits.concurrency).toBe(2)
    }
  })
})
