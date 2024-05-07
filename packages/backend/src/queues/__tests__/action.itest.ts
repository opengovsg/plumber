import { describe, expect, it } from 'vitest'

import apps from '@/apps'

import { actionQueuesByName } from '../action'

describe('Action Queues', () => {
  // Colon is a reserved character for makeActionJobId
  it('does not have any queues with colon in its name', () => {
    for (const queueName of Object.keys(actionQueuesByName)) {
      expect(queueName).not.toContain(':')
    }
  })

  it('check that delayable queues have queue rate limits defined', () => {
    for (const app of Object.values(apps)) {
      if (!app.queue) {
        continue
      }

      if (app.queue.isQueueDelayable) {
        expect(app.queue.queueRateLimit).not.toBeNull()
        expect(app.queue.queueRateLimit).not.toBeUndefined()
      }
    }
  })
})
