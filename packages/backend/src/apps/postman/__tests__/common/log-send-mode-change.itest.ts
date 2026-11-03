import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import { spyOnLogger } from '@/test/spy-on-logger'

import {
  getSendMode,
  logSendModeChange,
} from '../../common/log-send-mode-change'

const postman = { appKey: 'postman', key: 'sendTransactionalEmail' }

describe('getSendMode', () => {
  it('reads the stored send mode of a Postman send-email step', () => {
    expect(
      getSendMode({ ...postman, parameters: { sendMode: 'individual' } }),
    ).toBe('individual')
  })

  it('falls back to combined for a Postman step without one', () => {
    expect(getSendMode({ ...postman, parameters: {} })).toBe('combined')
  })

  it('returns undefined for other steps', () => {
    expect(
      getSendMode({ appKey: 'slack', key: 'sendMessage', parameters: {} }),
    ).toBeUndefined()
    expect(getSendMode(undefined)).toBeUndefined()
  })
})

describe('logSendModeChange', () => {
  let flow: Flow
  let step: Step
  let logs: ReturnType<typeof spyOnLogger>

  async function addRun({
    testRun,
    stepId = step.id,
  }: {
    testRun: boolean
    stepId?: string
  }) {
    const execution = await Execution.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      testRun,
      internalId: `run-${randomUUID()}`,
      status: 'success',
    })
    return ExecutionStep.query().insert({
      id: randomUUID(),
      executionId: execution.id,
      stepId,
      dataIn: {},
      dataOut: {},
      status: 'success',
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      metadata: {},
    })
  }

  beforeEach(async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `send-mode-log-${randomUUID()}@example.com`,
    })
    flow = await Flow.query().insertAndFetch({
      id: randomUUID(),
      name: 'Send mode pipe',
      userId: user.id,
      // Steps on a published pipe cannot be edited.
      active: false,
    })
    step = await Step.query().insertAndFetch({
      id: randomUUID(),
      ...postman,
      type: 'action',
      flowId: flow.id,
      position: 2,
      parameters: { sendMode: 'individual' },
      status: 'completed',
    })
    logs = spyOnLogger()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function changedLog() {
    return logs.info.mock.calls.find(
      ([, meta]) => meta?.event === 'postman-step-send-mode-changed',
    )?.[1]
  }

  it('logs a new step switched to individual with no real run', async () => {
    await logSendModeChange({
      previous: { ...postman, parameters: {} },
      updated: step,
      source: 'editor',
    })

    expect(changedLog()).toEqual(
      expect.objectContaining({
        from: 'combined',
        to: 'individual',
        source: 'editor',
        stepId: step.id,
        flowId: flow.id,
        hasRealRun: false,
        flowActive: false,
        stepCreatedAtMs: new Date(step.createdAt).getTime(),
      }),
    )
  })

  it('treats a step that just became a Postman step as on the default', async () => {
    await logSendModeChange({
      previous: { appKey: null, key: null, parameters: {} },
      updated: step,
      source: 'editor',
    })

    expect(changedLog()).toEqual(
      expect.objectContaining({ from: 'combined', to: 'individual' }),
    )
  })

  it('reports a real run that reached this step', async () => {
    const run = await addRun({ testRun: false })

    await logSendModeChange({
      previous: { ...postman, parameters: { sendMode: 'combined' } },
      updated: step,
      source: 'ai_builder',
    })

    expect(changedLog()).toEqual(
      expect.objectContaining({
        source: 'ai_builder',
        hasRealRun: true,
        lastRealRunAt: new Date(run.createdAt).toISOString(),
        lastRealRunStatus: 'success',
      }),
    )
  })

  it('ignores test runs and runs of other steps', async () => {
    const otherStep = await Step.query().insertAndFetch({
      id: randomUUID(),
      ...postman,
      type: 'action',
      flowId: flow.id,
      position: 3,
      parameters: {},
      status: 'completed',
    })
    await addRun({ testRun: true })
    await addRun({ testRun: false, stepId: otherStep.id })

    await logSendModeChange({
      previous: { ...postman, parameters: { sendMode: 'combined' } },
      updated: step,
      source: 'editor',
    })

    expect(changedLog()).toEqual(expect.objectContaining({ hasRealRun: false }))
  })

  it('does not log when the send mode is unchanged', async () => {
    await logSendModeChange({
      previous: { ...postman, parameters: { sendMode: 'individual' } },
      updated: step,
      source: 'editor',
    })

    expect(changedLog()).toBeUndefined()
  })

  it('does not log for steps that are not Postman send-email steps', async () => {
    await logSendModeChange({
      previous: undefined,
      updated: { ...step, appKey: 'slack', key: 'sendMessage' },
      source: 'editor',
    })

    expect(changedLog()).toBeUndefined()
  })

  it('swallows lookup errors so the save is unaffected', async () => {
    vi.spyOn(Flow, 'query').mockImplementation(() => {
      throw new Error('db down')
    })

    await expect(
      logSendModeChange({
        previous: { ...postman, parameters: {} },
        updated: step,
        source: 'editor',
      }),
    ).resolves.toBeUndefined()
    expect(logs.warn).toHaveBeenCalledWith(
      'Failed to log Postman send mode change',
      expect.objectContaining({ errorMessage: 'db down' }),
    )
  })
})
