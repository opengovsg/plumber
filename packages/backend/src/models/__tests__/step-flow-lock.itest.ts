import { randomUUID } from 'crypto'

import type { Transaction } from 'objection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import deleteConnection from '@/graphql/mutations/delete-connection'
import Connection from '@/models/connection'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import flowQueue from '@/queues/flow'
import { updateFlowStatusService } from '@/services/flow/update-flow-status'
import type Context from '@/types/express/context'

async function countLockWaiters(): Promise<number> {
  const { rows } = await Flow.knex().raw<{ rows: { count: number }[] }>(
    `SELECT count(*)::int AS count FROM pg_stat_activity
     WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  )
  return rows[0].count
}

async function waitUntil(
  condition: () => Promise<boolean>,
  description: string,
): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function waitForLockWaiters(count: number): Promise<void> {
  await waitUntil(
    async () => (await countLockWaiters()) >= count,
    `${count} lock waiters`,
  )
}

function settle<T>(promise: Promise<T>): Promise<T | Error> {
  return promise.catch((error: Error) => error)
}

type Launch = <T>(promise: Promise<T>) => Promise<T | Error>

/**
 * Always ends `trx` and awaits the launched work, so a failed assertion cannot
 * leave locks held for later tests and the shared teardown.
 */
async function holding(
  trx: Transaction,
  body: (launch: Launch) => Promise<void>,
): Promise<void> {
  const launched: Promise<unknown>[] = []
  const launch: Launch = (promise) => {
    const settled = settle(promise)
    launched.push(settled)
    return settled
  }
  try {
    await body(launch)
  } finally {
    if (!trx.isCompleted()) {
      await trx.rollback()
    }
    await Promise.all(launched)
  }
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
    let publishResult!: Promise<Flow | Error>
    let updateResult!: Promise<Step | Error>
    await holding(gate, async (launch) => {
      await Flow.query(gate).findById(flowId).forNoKeyUpdate()
      publishResult = launch(publish())
      await waitForLockWaiters(1)
      updateResult = launch(
        Step.transaction(async (trx) =>
          Step.query(trx).patchAndFetchById(actionStepId, {
            parameters: { edited: true },
          }),
        ),
      )
      await waitForLockWaiters(2)
      await gate.commit()
    })

    expect(await publishResult).toBeInstanceOf(Flow)
    const updateError = await updateResult
    expect(updateError).toBeInstanceOf(Error)
    expect((updateError as Error).message).toBe('Cannot edit published pipe.')
    const step = await Step.query().findById(actionStepId).throwIfNotFound()
    expect(step.parameters).toEqual({})
  })

  it('rejects a step insert that waits on a publish which commits first', async () => {
    const gate = await Flow.startTransaction()
    let publishResult!: Promise<Flow | Error>
    let insertResult!: Promise<Step | Error>
    await holding(gate, async (launch) => {
      await Flow.query(gate).findById(flowId).forNoKeyUpdate()
      publishResult = launch(publish())
      await waitForLockWaiters(1)
      insertResult = launch(
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
    })

    expect(await publishResult).toBeInstanceOf(Flow)
    const insertError = await insertResult
    expect(insertError).toBeInstanceOf(Error)
    expect((insertError as Error).message).toBe('Cannot edit published pipe.')
    expect(await Step.query().where('flow_id', flowId).resultSize()).toBe(2)
  })

  it('lets publish proceed after a step update commits first', async () => {
    const stepTrx = await Step.startTransaction()
    let publishResult!: Promise<Flow | Error>
    await holding(stepTrx, async (launch) => {
      await Step.query(stepTrx).patchAndFetchById(actionStepId, {
        parameters: { edited: true },
      })
      publishResult = launch(publish())
      await waitForLockWaiters(1)
      await stepTrx.commit()
    })

    expect(await publishResult).toBeInstanceOf(Flow)
    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    expect(flow.active).toBe(true)
    const step = await Step.query().findById(actionStepId).throwIfNotFound()
    expect(step.parameters).toEqual({ edited: true })
  })

  it('lets an execution insert proceed while a step write holds the flow lock', async () => {
    const stepTrx = await Step.startTransaction()
    let executionResult!: Promise<Execution | Error>
    await holding(stepTrx, async (launch) => {
      await Step.query(stepTrx).patchAndFetchById(actionStepId, {
        parameters: { edited: true },
      })
      executionResult = launch(
        Execution.query().insert({ flowId, testRun: true }).execute(),
      )
      const blocked = new Promise<'blocked'>((resolve) =>
        setTimeout(() => resolve('blocked'), 2000),
      )
      expect(await Promise.race([executionResult, blocked])).toBeInstanceOf(
        Execution,
      )
    })
  })
})

describe('publishing and deleting a connection', () => {
  let user: User
  let flowId: string
  let actionStepId: string
  let connectionA: Connection
  let connectionB: Connection

  beforeEach(async () => {
    user = await User.query().insert({
      id: randomUUID(),
      email: `${randomUUID()}@example.com`,
    })
    const [a, b] = await Promise.all(
      ['A', 'B'].map((name) =>
        Connection.query().insertAndFetch({
          userId: user.id,
          key: 'custom-api',
          formattedData: { screenName: `Connection ${name}` },
          verified: true,
        }),
      ),
    )
    connectionA = a
    connectionB = b
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
        appKey: 'scheduler',
        key: 'everyHour',
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
        connectionId: connectionA.id,
        parameters: {},
      },
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never leaves a published pipe on a deleted connection', async () => {
    // Holds publish open after its checks, so the delete can run before the
    // publish commits.
    let releaseQueueAdd!: () => void
    const queueAddReleased = new Promise<void>((resolve) => {
      releaseQueueAdd = resolve
    })
    let queueAddCalled = false
    vi.spyOn(flowQueue, 'add').mockImplementation(async () => {
      queueAddCalled = true
      await queueAddReleased
      return undefined as never
    })

    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    flow.steps = await flow.$relatedQuery('steps').orderBy('position')
    const context = { currentUser: user } as unknown as Context

    const stepTrx = await Step.startTransaction()
    let publishResult!: Promise<Flow | Error>
    let deleteResult!: Promise<unknown>
    await holding(stepTrx, async (launch) => {
      try {
        // A step save switching the connection from A to B is in flight.
        await Step.query(stepTrx).patchAndFetchById(actionStepId, {
          connectionId: connectionB.id,
        })
        publishResult = launch(
          updateFlowStatusService({
            flow,
            active: true,
            userId: user.id,
            updatedAt: flow.updatedAt,
          }),
        )
        await waitForLockWaiters(1)
        let deleteSettled = false
        deleteResult = launch(
          Promise.resolve(
            deleteConnection({}, { input: { id: connectionB.id } }, context),
          ),
        )
        void deleteResult.then(() => {
          deleteSettled = true
        })
        await waitForLockWaiters(2)

        await stepTrx.commit()
        await waitUntil(
          async () =>
            deleteSettled ||
            (queueAddCalled && (await countLockWaiters()) >= 1),
          'the delete to finish or wait on the publish',
        )
      } finally {
        releaseQueueAdd()
      }
    })

    const published = (await publishResult) instanceof Flow
    const deleted = (await deleteResult) === true
    expect(published !== deleted).toBe(true)
    const finalFlow = await Flow.query().findById(flowId).throwIfNotFound()
    const finalConnectionB = await Connection.query()
      .withSoftDeleted()
      .findById(connectionB.id)
      .throwIfNotFound()
    expect(finalFlow.active && finalConnectionB.deletedAt !== null).toBe(false)
  })
})
