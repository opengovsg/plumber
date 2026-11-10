import type { IGlobalVariable, IJSONObject } from '@plumber/types'
import { DateTime } from 'luxon'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockFlow,
  generateMockStep,
} from '@/graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import type Step from '@/models/step'

import getPastTimestampKind from '../helpers/get-past-timestamp-kind'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('getPastTimestampKind', () => {
  let step: Step
  let execution: Execution
  const target = DateTime.now().minus({ hours: 1 })

  beforeEach(async () => {
    const context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
    step = await generateMockStep(
      context,
      'delayFor',
      'delay',
      'action',
      FLOW_ID,
      2,
    )
    execution = await Execution.query().insertAndFetch({
      flowId: FLOW_ID,
      testRun: false,
    })
  })

  function makeGlobalVariable(iteration?: number): IGlobalVariable {
    return {
      execution: { id: execution.id, testRun: false },
      metadata: iteration === undefined ? undefined : { iteration },
    } as unknown as IGlobalVariable
  }

  async function insertExecutionStep({
    executionId = execution.id,
    status = 'success',
    appKey = 'formatter',
    key = 'dateTime',
    dataOut = {},
    iteration,
    createdAt,
  }: {
    executionId?: string
    status?: 'success' | 'failure'
    appKey?: string
    key?: string
    dataOut?: IJSONObject
    iteration?: number
    createdAt?: DateTime
  }) {
    const executionStep = await ExecutionStep.query().insertAndFetch({
      executionId,
      stepId: step.id,
      status,
      appKey,
      key,
      dataOut,
      metadata: iteration === undefined ? {} : { iteration },
    })
    if (createdAt) {
      await ExecutionStep.query()
        .findById(executionStep.id)
        .patch({ createdAt: createdAt.toISO() })
    }
  }

  it('is third-party when the run has no failures or earlier delays', async () => {
    await insertExecutionStep({})

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('third-party')
  })

  it('is config when an earlier step in the run failed', async () => {
    await insertExecutionStep({ status: 'failure' })
    await insertExecutionStep({})

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('config')
  })

  it('ignores failures in other executions', async () => {
    const otherExecution = await Execution.query().insertAndFetch({
      flowId: FLOW_ID,
      testRun: false,
    })
    await insertExecutionStep({
      executionId: otherExecution.id,
      status: 'failure',
    })

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('third-party')
  })

  it('ignores failures in other for-each iterations', async () => {
    await insertExecutionStep({ status: 'failure', iteration: 1 })

    await expect(
      getPastTimestampKind(makeGlobalVariable(2), target.toMillis()),
    ).resolves.toBe('third-party')
  })

  it('is config when a step before the for-each failed', async () => {
    await insertExecutionStep({ status: 'failure' })

    await expect(
      getPastTimestampKind(makeGlobalVariable(2), target.toMillis()),
    ).resolves.toBe('config')
  })

  it('is config when an earlier delay for ended at or after the target', async () => {
    await insertExecutionStep({
      appKey: 'delay',
      key: 'delayFor',
      dataOut: { delayForUnit: 'hours', delayForValue: '2' },
      createdAt: target.minus({ hours: 1 }),
    })

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('config')
  })

  it('is third-party when an earlier delay for ended before the target', async () => {
    await insertExecutionStep({
      appKey: 'delay',
      key: 'delayFor',
      dataOut: { delayForUnit: 'minutes', delayForValue: '30' },
      createdAt: target.minus({ hours: 1 }),
    })

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('third-party')
  })

  it('is config when an earlier delay until ended at or after the target', async () => {
    const earlierDelayEnd = target.plus({ minutes: 1 })
    await insertExecutionStep({
      appKey: 'delay',
      key: 'delayUntil',
      dataOut: {
        delayUntil: earlierDelayEnd.toFormat('dd MMM yyyy'),
        delayUntilTime: earlierDelayEnd.toFormat('HH:mm'),
      },
    })

    await expect(
      getPastTimestampKind(
        makeGlobalVariable(),
        target.startOf('minute').toMillis(),
      ),
    ).resolves.toBe('config')
  })

  it('is third-party when an earlier delay until ended before the target', async () => {
    const earlierDelayEnd = target.minus({ minutes: 5 })
    await insertExecutionStep({
      appKey: 'delay',
      key: 'delayUntil',
      dataOut: {
        delayUntil: earlierDelayEnd.toFormat('dd MMM yyyy'),
        delayUntilTime: earlierDelayEnd.toFormat('HH:mm'),
      },
    })

    await expect(
      getPastTimestampKind(makeGlobalVariable(), target.toMillis()),
    ).resolves.toBe('third-party')
  })
})
