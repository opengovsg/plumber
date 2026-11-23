import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import { updateFlowStatusService } from '@/services/flow/update-flow-status'

async function waitForLockWaiters(count: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await Flow.knex().raw<{ rows: { count: number }[] }>(
      `SELECT count(*)::int AS count FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    )
    if (rows[0].count >= count) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for ${count} lock waiters`)
}

function settle<T>(promise: Promise<T>): Promise<T | Error> {
  return promise.catch((error: Error) => error)
}

describe('step writes lock the flow row', () => {
  let user: User
  let flowId: string
  let actionStepId: string

  beforeEach(async () => {
    user = await User.query().insert({
      id: randomUUID(),
      email: `${randomUUID()}@example.com`,
    })
    flowId = randomUUID()
    actionStepId = randomUUID()
    await Flow.query().insert({
      id: flowId,
      name: 'test flow',
      userId: user.id,
      updatedBy: user.id,
    })
    await Step.query().insert([
      {
        flowId,
        type: 'trigger',
        position: 1,
        status: 'completed',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
      },
      {
        id: actionStepId,
        flowId,
        type: 'action',
        position: 2,
        status: 'completed',
        appKey: 'custom-api',
        key: 'httpRequest',
        parameters: {},
      },
    ])
  })

  async function publish(): Promise<Flow> {
    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    flow.steps = await flow.$relatedQuery('steps').orderBy('position')
    return updateFlowStatusService({
      flow,
      active: true,
      userId: user.id,
      updatedAt: flow.updatedAt,
    })
  }

  it('rejects a step update that waits on a publish which commits first', async () => {
    // Holds the flow row so publish and the step update queue up in order.
    const gate = await Flow.startTransaction()
    await Flow.query(gate).findById(flowId).forUpdate()

    const publishResult = settle(publish())
    await waitForLockWaiters(1)
    const updateResult = settle(
      Step.transaction(async (trx) =>
        Step.query(trx).patchAndFetchById(actionStepId, {
          parameters: { edited: true },
        }),
      ),
    )
    await waitForLockWaiters(2)
    await gate.commit()

    expect(await publishResult).toBeInstanceOf(Flow)
    const updateError = await updateResult
    expect(updateError).toBeInstanceOf(Error)
    expect((updateError as Error).message).toBe('Cannot edit published pipe.')
    const step = await Step.query().findById(actionStepId).throwIfNotFound()
    expect(step.parameters).toEqual({})
  })

  it('rejects a step insert that waits on a publish which commits first', async () => {
    const gate = await Flow.startTransaction()
    await Flow.query(gate).findById(flowId).forUpdate()

    const publishResult = settle(publish())
    await waitForLockWaiters(1)
    const insertResult = settle(
      Step.transaction(async (trx) =>
        Step.query(trx).insert({
          flowId,
          type: 'action',
          position: 3,
          appKey: 'custom-api',
          key: 'httpRequest',
          parameters: {},
        }),
      ),
    )
    await waitForLockWaiters(2)
    await gate.commit()

    expect(await publishResult).toBeInstanceOf(Flow)
    const insertError = await insertResult
    expect(insertError).toBeInstanceOf(Error)
    expect((insertError as Error).message).toBe('Cannot edit published pipe.')
    expect(await Step.query().where('flow_id', flowId).resultSize()).toBe(2)
  })

  it('lets publish proceed after a step update commits first', async () => {
    const stepTrx = await Step.startTransaction()
    await Step.query(stepTrx).patchAndFetchById(actionStepId, {
      parameters: { edited: true },
    })

    const publishResult = settle(publish())
    await waitForLockWaiters(1)
    await stepTrx.commit()

    expect(await publishResult).toBeInstanceOf(Flow)
    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    expect(flow.active).toBe(true)
    const step = await Step.query().findById(actionStepId).throwIfNotFound()
    expect(step.parameters).toEqual({ edited: true })
  })
})
