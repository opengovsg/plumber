import { randomUUID } from 'crypto'

import { describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import User from '@/models/user'

import { runAfterCommit } from '../after-commit'

describe('runAfterCommit with a real transaction', () => {
  it('runs after the commit, when the data is visible outside the transaction', async () => {
    const flowId = randomUUID()
    const user = await User.query().insert({
      id: randomUUID(),
      email: `after-commit-${randomUUID()}@plumber.gov.sg`,
    })
    let committedFlow: Promise<Flow | undefined> | undefined

    await Flow.transaction(async (trx) => {
      await Flow.query(trx).insert({
        id: flowId,
        name: 'pipe',
        userId: user.id,
      })
      runAfterCommit(trx, () => {
        // Reads outside the transaction, so it sees the row only after the commit.
        committedFlow = Flow.query()
          .findById(flowId)
          .then((flow) => flow)
      })
      expect(committedFlow).toBeUndefined()
    })
    await vi.waitFor(() => expect(committedFlow).toBeDefined())

    await expect(committedFlow).resolves.toMatchObject({ id: flowId })
  })

  it('never runs when the transaction rolls back', async () => {
    const fn = vi.fn()

    await expect(
      Flow.transaction(async (trx) => {
        runAfterCommit(trx, fn)
        throw new Error('roll back')
      }),
    ).rejects.toThrow('roll back')
    await new Promise((resolve) => setImmediate(resolve))

    expect(fn).not.toHaveBeenCalled()
  })
})
