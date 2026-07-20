import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type Context from '@/types/express/context'

import action from '../../actions/mrf-submission/index'
import {
  createMrfActionStep as createMrfActionStepBase,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
  generateMockStep,
} from '../mrf.mock'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('mrf-submission action (integration)', () => {
  let context: Context
  let flow: Flow
  let triggerStep: Step

  beforeEach(async () => {
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
    flow = await Flow.query().findById(FLOW_ID)
    triggerStep = await generateMockStep(
      context,
      'newSubmission',
      'formsg',
      'trigger',
      FLOW_ID,
      1,
    )
  })

  function createMrfActionStep(
    position: number,
    overrides?: { approvalField?: string },
  ) {
    return createMrfActionStepBase({
      context,
      flowId: FLOW_ID,
      position,
      formWorkflowStepId: `workflow-step-${String(position).padStart(3, '0')}`,
      fields: ['field-a'],
      approvalField: overrides?.approvalField,
    })
  }

  function createGlobalVariable(
    step: Step,
    execution: Execution,
  ): IGlobalVariable {
    return {
      step: {
        id: step.id,
        appKey: step.appKey,
        position: step.position,
        parameters: step.parameters || {},
      },
      flow: {
        id: flow.id,
      },
      app: {
        name: 'formsg',
      },
      execution: {
        id: execution.id,
        testRun: false,
      },
      setActionItem: vi.fn(),
      getLastExecutionStep: async (
        options: Partial<{
          sameExecution: boolean
          testRunOnly?: boolean
        }>,
      ) => {
        const result = await step.getLastExecutionStep({
          executionId: options?.sameExecution ? execution.id : undefined,
          testRunOnly: options?.testRunOnly,
        })
        return result?.toJSON()
      },
    } as unknown as IGlobalVariable
  }

  describe('run', () => {
    it('should pause execution when previous execution step is failed', async () => {
      const mrfStep = await createMrfActionStep(2)
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      // Trigger's execution step is failed
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'failure',
        dataOut: null,
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when previous execution step is missing', async () => {
      const mrfStep = await createMrfActionStep(2)
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      // No execution step for the trigger at all

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when no webhook yet (getLastExecutionStep returns null)', async () => {
      const mrfStep = await createMrfActionStep(2)
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      // Trigger succeeded
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      // But no execution step for the MRF action step itself

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should continue when step does not require approval', async () => {
      const mrfStep = await createMrfActionStep(2)
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      // Trigger succeeded
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      // MRF step has webhook data with non-approval submitted step
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: false,
                submittedAt: '2024-01-01T00:00:00.000Z',
              },
            ],
          },
        },
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should continue when approval step is approved', async () => {
      const mrfStep = await createMrfActionStep(2, {
        approvalField: 'approval-field',
      })
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: true,
                submittedAt: '2024-01-01T00:00:00.000Z',
                status: 'APPROVED',
              },
            ],
          },
        },
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should jump to rejection branch step when rejected', async () => {
      const mrfStep = await createMrfActionStep(2, {
        approvalField: 'approval-field',
      })
      const rejectStep = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: true,
                submittedAt: '2024-01-01T00:00:00.000Z',
                status: 'REJECTED',
              },
            ],
          },
        },
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: {
          command: 'jump-to-step',
          stepId: rejectStep.id,
        },
      })
    })

    it('should stop execution when rejected but no rejection branch exists', async () => {
      const mrfStep = await createMrfActionStep(2, {
        approvalField: 'approval-field',
      })
      // No reject branch step created
      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: true,
                submittedAt: '2024-01-01T00:00:00.000Z',
                status: 'REJECTED',
              },
            ],
          },
        },
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'stop-execution' },
      })
    })

    it('should skip rejection branch steps when finding previous executable step', async () => {
      // Layout: trigger(1) -> mrfStep2(2) -> rejectBranch(3) -> mrfStep3(4)
      // When running mrfStep3, the previous executable step should be mrfStep2,
      // not the rejection branch step at position 3
      const mrfStep2 = await createMrfActionStep(2, {
        approvalField: 'approval-field',
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      const mrfStep3 = await createMrfActionStep(4)

      const execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })

      // Trigger succeeded
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      // mrfStep2 succeeded (the real previous executable step)
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep2.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      // mrfStep3 has webhook data
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep3.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: false,
                submittedAt: '2024-01-01T00:00:00.000Z',
              },
            ],
          },
        },
        appKey: 'formsg',
      })

      const $ = createGlobalVariable(mrfStep3, execution)
      const result = await action.run($)

      // Should continue normally because mrfStep2 (the real previous step) succeeded
      // If the rejection branch step were incorrectly picked as the previous step,
      // it would pause since there's no execution step for it
      expect(result).toBeUndefined()
    })
  })

  /**
   * Layout: trigger(1) -> mrfStep2(2) -> ifThen(3) -> blockChild(4) -> mrfStep3(5),
   * where the if-then V2 block is `(ifThen, blockChild]`. Region confinement lets
   * a block end right before an MRF step like this, so a FALSE condition resumes
   * execution *at* mrfStep3 with blockChild never run — mrfStep3 must not read
   * blockChild's missing execution step as "execution has not got here yet".
   */
  describe('run - previous executable step inside an if-then V2 block', () => {
    let mrfStep2: Step
    let ifThenStep: Step
    let blockChild: Step
    let mrfStep3: Step
    let execution: Execution

    beforeEach(async () => {
      mrfStep2 = await createMrfActionStep(2)
      blockChild = await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        FLOW_ID,
        4,
      )
      ifThenStep = await generateMockStep(
        context,
        'ifThen',
        'toolbox',
        'action',
        FLOW_ID,
        3,
        {},
        { endStepId: blockChild.id },
      )
      mrfStep3 = await createMrfActionStep(5)

      execution = await Execution.query().insertAndFetch({
        flowId: FLOW_ID,
        testRun: false,
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: triggerStep.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep2.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      // The next respondent has already submitted.
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStep3.id,
        status: 'success',
        dataOut: {
          workflowContent: {
            submittedSteps: [
              { isApproval: false, submittedAt: '2024-01-01T00:00:00.000Z' },
            ],
          },
        },
        appKey: 'formsg',
      })
    })

    async function insertIfThenExecutionStep(isConditionMet: boolean) {
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: ifThenStep.id,
        status: 'success',
        dataOut: { isConditionMet },
        appKey: 'toolbox',
      })
    }

    async function insertBlockChildExecutionStep() {
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: blockChild.id,
        status: 'success',
        dataOut: {},
        appKey: 'postman',
      })
    }

    it('should continue when the block was skipped by a FALSE condition', async () => {
      await insertIfThenExecutionStep(false)

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toBeUndefined()
    })

    it('should continue when the block ran to its end', async () => {
      await insertIfThenExecutionStep(true)
      await insertBlockChildExecutionStep()

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toBeUndefined()
    })

    it('should pause execution while a TRUE block is still running', async () => {
      await insertIfThenExecutionStep(true)

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution before the if-then itself has run', async () => {
      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when the if-then failed', async () => {
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: ifThenStep.id,
        status: 'failure',
        dataOut: { isConditionMet: false },
        appKey: 'toolbox',
      })

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should continue when an only-continue-if inside the block aborted it', async () => {
      // Squeeze an only-continue-if into the block: trigger(1) -> mrfStep2(2) ->
      // ifThen(3) -> onlyContinueIf(4) -> blockChild(5) -> mrfStep3(6).
      await mrfStep3.$query().patch({ position: 6 })
      await blockChild.$query().patch({ position: 5 })
      const onlyContinueIfStep = await generateMockStep(
        context,
        'onlyContinueIf',
        'toolbox',
        'action',
        FLOW_ID,
        4,
      )
      await insertIfThenExecutionStep(true)
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: onlyContinueIfStep.id,
        status: 'success',
        dataOut: { result: false },
        appKey: 'toolbox',
      })

      const $ = createGlobalVariable(
        await Step.query().findById(mrfStep3.id),
        execution,
      )

      expect(await action.run($)).toBeUndefined()
    })
  })
})
