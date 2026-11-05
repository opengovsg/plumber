import { describe, expect, it, vi } from 'vitest'

// Imported here, not in the test, so loading every app does not count against the test timeout.
import '@/queues/action'

import { ACTION_QUEUES, type ActionQueue } from '../action-queues'

const mocks = vi.hoisted(() => ({
  makeActionQueue: vi.fn(
    (params: { queueName: string; redisConnectionPrefix?: string }) => ({
      name: params.queueName,
      close: vi.fn(async () => undefined),
    }),
  ),
}))

vi.mock('@/queues/helpers/make-action-queue', () => ({
  makeActionQueue: mocks.makeActionQueue,
}))

function sortByName(queues: ActionQueue[]): ActionQueue[] {
  return [...queues].sort((a, b) => a.name.localeCompare(b.name))
}

describe('ACTION_QUEUES', () => {
  it('matches the action queues the worker creates from the app registry', () => {
    const createdQueues = mocks.makeActionQueue.mock.calls.map(([params]) => ({
      // BullMQ's default key prefix.
      prefix: params.redisConnectionPrefix ?? 'bull',
      name: params.queueName,
    }))
    expect(
      sortByName(ACTION_QUEUES),
      'Update ACTION_QUEUES in services/reconciler/checks/delayed-jobs/action-queues.ts to match the action queues in @/queues/action',
    ).toEqual(sortByName(createdQueues))
  })
})
