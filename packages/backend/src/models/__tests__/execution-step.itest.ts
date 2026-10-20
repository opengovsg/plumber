import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import Execution from '../execution'
import ExecutionStep from '../execution-step'
import Flow from '../flow'
import Step from '../step'
import User from '../user'

describe('ExecutionStep.getLatestFailedStep', () => {
  let executionId: string
  let stepId: string

  beforeEach(async () => {
    const user = await User.query().insert({
      id: randomUUID(),
      email: 'test@example.com',
    })
    const flowId = randomUUID()
    await Flow.query().insert({ id: flowId, name: 'flow', userId: user.id })
    stepId = randomUUID()
    await Step.query().insert({
      id: stepId,
      flowId,
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      type: 'action',
      status: 'completed',
      position: 2,
      parameters: {},
    })
    executionId = randomUUID()
    await Execution.query().insert({ id: executionId, flowId })
  })

  async function insertStep(
    status: 'success' | 'failure',
    createdAt: string,
    kind?: string,
  ): Promise<string> {
    const id = randomUUID()
    await ExecutionStep.query().insert({
      id,
      executionId,
      stepId,
      status,
      appKey: 'postman',
      errorDetails: kind ? { kind } : null,
    })
    await ExecutionStep.query().findById(id).patch({ createdAt })
    return id
  }

  it('returns the most recent failed step', async () => {
    await insertStep('failure', '2026-10-20T00:00:00.000Z', 'config')
    const latestId = await insertStep(
      'failure',
      '2026-10-20T00:01:00.000Z',
      'third-party',
    )
    await insertStep('success', '2026-10-20T00:02:00.000Z')

    const step = await ExecutionStep.getLatestFailedStep(executionId)

    expect(step).toMatchObject({
      id: latestId,
      errorDetails: { kind: 'third-party' },
    })
  })

  it('returns undefined when no step failed', async () => {
    await insertStep('success', '2026-10-20T00:00:00.000Z')

    expect(await ExecutionStep.getLatestFailedStep(executionId)).toBeUndefined()
  })
})
