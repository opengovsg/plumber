import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { retryOnTransientDbError } from '@/helpers/retry-on-transient-db-error'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import * as shouldTriggerProceedModule from '@/services/helpers/should-trigger-proceed'
import { spyOnLogger } from '@/test/spy-on-logger'

import { processTrigger } from '../trigger'

const shouldTriggerProceed = vi.fn()

// Simulates a Postgres failover / connection-drop error that the retry helper
// classifies as transient (SQLSTATE 57P01 = admin_shutdown).
function makeTransientPgError(): Error & { code: string } {
  const err = new Error(
    'terminating connection due to administrator command',
  ) as Error & { code: string }
  err.code = '57P01'
  return err
}

describe('transient DB retry idempotency (real DB)', () => {
  let flow: Flow
  let triggerStep: Step

  beforeEach(async () => {
    vi.clearAllMocks()

    vi.spyOn(
      shouldTriggerProceedModule,
      'shouldTriggerProceed',
    ).mockImplementation(shouldTriggerProceed as never)
    spyOnLogger()

    const user = await User.query().findOne({ email: 'tester@open.gov.sg' })
    flow = await Flow.query().insertGraphAndFetch({
      userId: user.id,
      name: 'db-retry-test-flow',
      steps: [
        {
          appKey: 'mock-app',
          key: 'mock-trigger',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
      ],
    })
    triggerStep = flow.steps[0]
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('processTrigger', () => {
    it('creates exactly one execution + execution step when the insert transaction is retried after a transient error', async () => {
      shouldTriggerProceed.mockResolvedValue({ shouldExecute: true })

      // Force the first committed transaction to surface a transient error (as
      // if the connection dropped after COMMIT), then succeed on the retry. The
      // retry re-runs the same closure, which reuses the precomputed ids and so
      // must hit the onConflict path instead of inserting duplicate rows.
      const realTransaction = Execution.transaction.bind(Execution)
      let txCalls = 0
      vi.spyOn(Execution, 'transaction').mockImplementation(((
        ...args: unknown[]
      ) => {
        txCalls += 1
        return (realTransaction as (...a: unknown[]) => Promise<unknown>)(
          ...args,
        ).then((result) => {
          if (txCalls === 1) {
            throw makeTransientPgError()
          }
          return result
        })
      }) as typeof Execution.transaction)

      const result = await processTrigger({
        flowId: flow.id,
        stepId: triggerStep.id,
        triggerItem: {
          raw: { field: 'value' },
          meta: { internalId: 'retry-internal-1' },
        },
        testRun: false,
      })

      // The retry actually fired.
      expect(txCalls).toBe(2)

      // No orphaned / duplicate rows: exactly one execution and one step.
      const executions = await Execution.query().where({ flow_id: flow.id })
      expect(executions).toHaveLength(1)
      const executionSteps = await ExecutionStep.query().where({
        execution_id: result.executionId,
      })
      expect(executionSteps).toHaveLength(1)

      // The committed step is returned to the caller (the trigger worker reads
      // executionStep.isFailed, so this must not be null).
      expect(result.executionStep).not.toBeNull()
      expect(result.executionStep?.id).toBe(executionSteps[0].id)
      expect(result.executionStep?.isFailed).toBe(false)
    }, 20000)
  })

  describe('retryOnTransientDbError + onConflict refetch', () => {
    let execution: Execution

    beforeEach(async () => {
      execution = await Execution.query().insertAndFetch({
        flowId: flow.id,
        testRun: false,
      })
    })

    it('does not insert a duplicate and returns the already-committed row when a transient error fires after commit', async () => {
      // This mirrors the exact persistence pattern used by processTrigger /
      // processAction / processSubTrigger: a precomputed id + insertAndFetch +
      // onConflict('id').ignore().
      const executionStepId = randomUUID()
      let attempts = 0

      const result = await retryOnTransientDbError(
        async () => {
          attempts += 1
          // The retry re-runs with the SAME precomputed id. Vary the payload by
          // attempt so we can prove the retry refetches the first (committed)
          // row rather than overwriting it or inserting a second one.
          const attemptLabel = attempts === 1 ? 'first' : 'second'
          const row = await ExecutionStep.query()
            .insertAndFetch({
              id: executionStepId,
              executionId: execution.id,
              stepId: triggerStep.id,
              status: 'success',
              dataIn: {},
              dataOut: { attempt: attemptLabel },
              appKey: 'mock-app',
              key: 'mock-trigger',
            })
            .onConflict('id')
            .ignore()

          if (attempts === 1) {
            // Row is committed at this point; simulate the connection dropping
            // before the client receives the response.
            throw makeTransientPgError()
          }
          return row
        },
        { initialDelayMs: 1, maxDelayMs: 5 },
      )

      expect(attempts).toBe(2)

      // Exactly one row exists for the precomputed id...
      const rows = await ExecutionStep.query().where({ id: executionStepId })
      expect(rows).toHaveLength(1)

      // ...and the returned row is the one committed on the first attempt, not
      // the (ignored) retry payload.
      expect(result?.id).toBe(executionStepId)
      expect(result?.dataOut).toEqual({ attempt: 'first' })
    })

    it('does not retry non-transient errors and leaves the committed row intact', async () => {
      const executionStepId = randomUUID()
      let attempts = 0

      await expect(
        retryOnTransientDbError(async () => {
          attempts += 1
          await ExecutionStep.query()
            .insertAndFetch({
              id: executionStepId,
              executionId: execution.id,
              stepId: triggerStep.id,
              status: 'success',
              dataIn: {},
              dataOut: {},
              appKey: 'mock-app',
              key: 'mock-trigger',
            })
            .onConflict('id')
            .ignore()

          // A non-transient application error (unique violation) must propagate
          // untouched, with no retry.
          const err = new Error('non-transient failure') as Error & {
            code: string
          }
          err.code = '23505'
          throw err
        }),
      ).rejects.toMatchObject({ code: '23505' })

      expect(attempts).toBe(1)
      const rows = await ExecutionStep.query().where({ id: executionStepId })
      expect(rows).toHaveLength(1)
    })
  })
})
