import type { Transaction } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureServerEvent } from '@/helpers/server-events'

import { captureFlowEvent } from '../flow-events'

vi.mock('@/helpers/server-events', () => ({ captureServerEvent: vi.fn() }))

const input = {
  event: 'flow_collaborator_added',
  actorUserId: 'owner-1',
  flowId: 'flow-1',
  properties: {
    collaborator_user_id: 'user-2',
    role: 'editor',
    source: 'app',
  },
} as const

function fakeTransaction(executionPromise: Promise<unknown>): Transaction {
  return { executionPromise } as unknown as Transaction
}

beforeEach(() => {
  vi.mocked(captureServerEvent).mockClear()
})

describe('captureFlowEvent', () => {
  it('sends at once without a transaction, with flow_id and the acting user', () => {
    captureFlowEvent(input)

    expect(captureServerEvent).toHaveBeenCalledWith({
      distinctId: 'owner-1',
      event: 'flow_collaborator_added',
      properties: {
        collaborator_user_id: 'user-2',
        role: 'editor',
        source: 'app',
        flow_id: 'flow-1',
      },
    })
  })

  it('waits for the transaction to commit', async () => {
    let commit!: () => void
    const trx = fakeTransaction(
      new Promise<void>((resolve) => (commit = resolve)),
    )

    captureFlowEvent({ ...input, trx })
    expect(captureServerEvent).not.toHaveBeenCalled()

    commit()
    await trx.executionPromise
    await Promise.resolve()
    expect(captureServerEvent).toHaveBeenCalledOnce()
  })

  it('sends nothing when the transaction rolls back', async () => {
    const trx = fakeTransaction(Promise.reject(new Error('rolled back')))

    captureFlowEvent({ ...input, trx })
    await expect(trx.executionPromise).rejects.toThrow()
    await Promise.resolve()

    expect(captureServerEvent).not.toHaveBeenCalled()
  })
})
