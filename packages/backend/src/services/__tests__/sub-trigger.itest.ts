import type { ITriggerItem, SubtriggerData } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMrfActionStep,
  generateMockContext,
  generateMockFlow,
  generateMockStep,
} from '@/apps/formsg/__tests__/mrf.mock'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import type Context from '@/types/express/context'

import {
  processSubTrigger,
  type ProcessSubTriggerOptions,
} from '../sub-trigger'

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
  },
}))

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('processSubTrigger integration', () => {
  let context: Context

  beforeEach(async () => {
    vi.resetAllMocks()
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
  })

  async function createExecution(internalId: string, testRun = false) {
    return Execution.query().insertAndFetch({
      flowId: FLOW_ID,
      testRun,
      internalId,
    })
  }

  function createOptions(
    overrides: Partial<{
      flowId: string
      internalId: string
      mrfStepId: string
      subtriggerType: string
      rawData: Record<string, unknown>
    }> = {},
  ): ProcessSubTriggerOptions {
    return {
      flowId: overrides.flowId ?? FLOW_ID,
      triggerItem: {
        meta: {
          internalId: overrides.internalId ?? 'internal-123',
        },
        raw: overrides.rawData ?? { field: 'value' },
      } as unknown as ITriggerItem,
      subtriggerData: {
        type: overrides.subtriggerType ?? 'mrf',
        mrfStepId: overrides.mrfStepId ?? 'wf-step-002',
      } as SubtriggerData,
    }
  }

  describe('validation guards', () => {
    it('should return null when subtriggerData.type is not mrf', async () => {
      const options = createOptions({ subtriggerType: 'other' })

      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.stringContaining('not MRF'),
        expect.objectContaining({
          event: 'sub-trigger-subtrigger-data-type-not-mrf',
        }),
      )
    })

    it('should return null when internalId is missing', async () => {
      const options = createOptions()
      ;(
        options.triggerItem as unknown as { meta: { internalId: undefined } }
      ).meta.internalId = undefined

      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.stringContaining('No internalId'),
        expect.objectContaining({
          event: 'sub-trigger-no-internal-id',
        }),
      )
    })
  })

  describe('execution lookup', () => {
    it('should return null when no execution exists for the given internalId', async () => {
      const options = createOptions({ internalId: 'nonexistent' })

      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('No existing execution found'),
        expect.objectContaining({
          event: 'sub-trigger-no-execution',
        }),
      )
    })

    it('should find execution matching flow_id + internal_id with test_run=false', async () => {
      const execution = await createExecution('internal-123', false)
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-002',
      })

      const options = createOptions({ internalId: 'internal-123' })
      const result = await processSubTrigger(options)

      expect(result).not.toBeNull()
      expect(result?.executionId).toBe(execution.id)
    })

    it('should ignore test_run=true executions', async () => {
      await createExecution('internal-123', true)

      const options = createOptions({ internalId: 'internal-123' })
      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('No existing execution found'),
        expect.objectContaining({
          event: 'sub-trigger-no-execution',
        }),
      )
    })
  })

  describe('MRF step resolution', () => {
    it('should return null when no MRF action step matches mrfStepId', async () => {
      await createExecution('internal-123')
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-001',
      })

      const options = createOptions({ mrfStepId: 'wf-step-999' })
      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.stringContaining('MRF step not found'),
        expect.objectContaining({
          event: 'sub-trigger-mrf-step-not-found',
        }),
      )
    })

    it('should correctly match step by formWorkflowStepId among multiple steps', async () => {
      await createExecution('internal-123')
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-001',
      })
      const targetStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        formWorkflowStepId: 'wf-step-002',
      })
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 4,
        formWorkflowStepId: 'wf-step-003',
      })

      const options = createOptions({ mrfStepId: 'wf-step-002' })
      const result = await processSubTrigger(options)

      expect(result).not.toBeNull()
      expect(result?.nextStep?.id).toBe(targetStep.id)
    })

    it('should ignore non-formsg and non-mrfSubmission steps', async () => {
      await createExecution('internal-123')
      // Create a non-MRF step with matching formWorkflowStepId in parameters
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        FLOW_ID,
        2,
        { mrf: { formWorkflowStepId: 'wf-step-002' } },
      )

      const options = createOptions({ mrfStepId: 'wf-step-002' })
      const result = await processSubTrigger(options)

      expect(result).toBeNull()
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.stringContaining('MRF step not found'),
        expect.objectContaining({
          event: 'sub-trigger-mrf-step-not-found',
        }),
      )
    })
  })

  describe('execution step creation', () => {
    it('should create execution step with correct fields', async () => {
      const execution = await createExecution('internal-123')
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-002',
      })

      const rawData = { answer1: 'hello', answer2: 'world' }
      const options = createOptions({ rawData })
      const result = await processSubTrigger(options)

      expect(result).not.toBeNull()
      const execStep = result.executionStep
      expect(execStep.stepId).toBe(mrfStep.id)
      expect(execStep.executionId).toBe(execution.id)
      expect(execStep.dataIn).toEqual(mrfStep.parameters)
      expect(execStep.dataOut).toEqual(rawData)
      expect(execStep.appKey).toBe('formsg')
      expect(execStep.key).toBe('mrfSubmission')
    })

    it('should return full result object with shouldExecute true', async () => {
      const execution = await createExecution('internal-123')
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-002',
      })

      const options = createOptions()
      const result = await processSubTrigger(options)

      expect(result).toEqual({
        executionId: execution.id,
        executionStep: expect.objectContaining({
          stepId: mrfStep.id,
          executionId: execution.id,
        }),
        nextStep: expect.objectContaining({ id: mrfStep.id }),
        shouldExecute: true,
      })
    })

    it('should return null executionStep when execution step already exists (dedupe)', async () => {
      const execution = await createExecution('internal-123')
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        formWorkflowStepId: 'wf-step-002',
      })

      // First call creates the execution step
      const options = createOptions()
      const firstResult = await processSubTrigger(options)
      expect(firstResult?.executionStep).not.toBeNull()

      // Second call should find existing and return null executionStep
      const secondResult = await processSubTrigger(options)
      expect(secondResult).toEqual({
        executionId: execution.id,
        executionStep: null,
        nextStep: expect.objectContaining({ id: mrfStep.id }),
        shouldExecute: true,
      })

      // Verify only one execution step was created in the DB
      const allExecSteps = await ExecutionStep.query().where({
        execution_id: execution.id,
        step_id: mrfStep.id,
      })
      expect(allExecSteps).toHaveLength(1)
    })
  })
})
