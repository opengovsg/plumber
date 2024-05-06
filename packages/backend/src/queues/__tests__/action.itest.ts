import { describe, expect, it } from 'vitest'

import { actionQueuesByName } from '../action'

describe('Action Queues', () => {
  // Colon is a reserved character for makeActionJobId
  it('does not have any queues with colon in its name', () => {
    for (const queueName of Object.keys(actionQueuesByName)) {
      expect(queueName).not.toContain(':')
    }
  })
})
