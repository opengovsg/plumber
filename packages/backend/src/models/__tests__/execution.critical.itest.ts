/**
 * Business rules:
 * - "Count an execution only when it ends. Ignore pending executions."
 * - "One count per execution end, even when for-each sets `failure` twice."
 * - "A user retry counts again."
 * - "`success` may still overwrite `failure`, as today, but emits no count."
 */
import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { countExecutionEnd } from '@/helpers/execution-end'

import Execution from '../execution'
import Flow from '../flow'
import User from '../user'

async function insertExecution(testRun = false): Promise<string> {
  const id = randomUUID()
  await Execution.query().insert({ id, flowId, testRun })
  return id
}

async function getStatus(executionId: string) {
  return (await Execution.query().findById(executionId)).status
}

let flowId: string

const mocks = vi.hoisted(() => ({ incrementMetric: vi.fn() }))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
}))

describe('Execution.setStatus', () => {
  beforeEach(async () => {
    mocks.incrementMetric.mockClear()
    const user = await User.query().insert({
      id: randomUUID(),
      email: 'test@example.com',
    })
    flowId = randomUUID()
    await Flow.query().insert({ id: flowId, name: 'flow', userId: user.id })
  })

  it('ends a pending execution', async () => {
    const executionId = await insertExecution()

    const ended = await Execution.setStatus(executionId, 'success')

    expect(ended).toMatchObject({ id: executionId, testRun: false })
    expect(await getStatus(executionId)).toBe('success')
  })

  it('ends an execution once when for-each sets failure twice', async () => {
    const executionId = await insertExecution()

    const first = await Execution.setStatus(executionId, 'failure')
    const second = await Execution.setStatus(executionId, 'failure')

    expect(first).toBeDefined()
    expect(second).toBeUndefined()
    expect(await getStatus(executionId)).toBe('failure')
  })

  it('ends an execution again after a user retry resets its status', async () => {
    const executionId = await insertExecution()
    await Execution.setStatus(executionId, 'failure')

    await Execution.query().findById(executionId).patch({ status: null })
    const ended = await Execution.setStatus(executionId, 'success')

    expect(ended).toBeDefined()
    expect(await getStatus(executionId)).toBe('success')
  })

  it('reports a test run', async () => {
    const executionId = await insertExecution(true)

    const ended = await Execution.setStatus(executionId, 'success')

    expect(ended).toMatchObject({ testRun: true })
  })

  it('does not let failure overwrite success', async () => {
    const executionId = await insertExecution()
    await Execution.setStatus(executionId, 'success')

    const ended = await Execution.setStatus(executionId, 'failure')

    expect(ended).toBeUndefined()
    expect(await getStatus(executionId)).toBe('success')
  })

  it('shows success after a for-each retry succeeds on a failed execution, with one count', async () => {
    const executionId = await insertExecution()

    countExecutionEnd(
      await Execution.setStatus(executionId, 'failure'),
      'third-party',
    )
    countExecutionEnd(
      await Execution.setStatus(executionId, 'success'),
      'success',
    )

    expect(await getStatus(executionId)).toBe('success')
    expect(mocks.incrementMetric.mock.calls).toEqual([
      ['plumber.executions.ended', { outcome: 'third_party' }],
    ])
  })
})
