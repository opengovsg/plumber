/**
 * Business rules:
 * - "Count an execution only when it ends. Ignore pending executions."
 * - "One count per execution end, even when for-each sets `failure` twice."
 * - "A user retry counts again."
 */
import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

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

describe('Execution.setStatus', () => {
  beforeEach(async () => {
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
})
