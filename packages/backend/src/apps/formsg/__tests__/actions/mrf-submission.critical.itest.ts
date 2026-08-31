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
  generateMockContext,
  generateMockFlow,
  generateMockStep,
} from '../mrf.mock'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

/**
 * BUSINESS-CRITICAL TESTS. This file pins down the business rules
 * `hasExecutionReachedMe` (in `../../actions/mrf-submission/index.ts`) must
 * satisfy for gating a new MRF sub-trigger on the "previous MRF region" (the
 * steps between the previous mrf-submission/trigger and this one,
 * exclusive/inclusive):
 *
 *   A. Must NOT continue if any step in the region failed execution.
 *   B. Must NOT continue if a top-level only-continue-if (i.e. not inside an
 *      if-then V2 block) in the region returned false.
 *   C. Must continue only once every step in the region has either finished
 *      execution, or was skipped by an if-then V2 block (or an
 *      only-continue-if inside one).
 *
 * These were specified by the user, not inferred from the implementation. If
 * a test tagged "Rule A/B/C" below starts failing, that almost always means
 * the implementation regressed, not that the rule is wrong. STOP and confirm
 * with the user before loosening or deleting a Rule-tagged assertion.
 *
 * General (non-rule) coverage for this action lives in `mrf-submission.itest.ts`.
 */
describe('mrf-submission action gating rules (integration)', () => {
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
    // Rule A: the immediately preceding step failed.
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

    // Rule A: a step earlier in the region failed, not just the immediately
    // preceding one. Execution halts at the failure (the normal action
    // worker never enqueues the step after a failed one), so the later,
    // never-run step has no execution-step row of its own either -- this
    // proves that absence is correctly read as "must not continue" rather
    // than accidentally treated as "reached".
    it('should pause execution when an earlier (non-immediate) step in the region failed', async () => {
      const mrfStepA = await createMrfActionStep(2)
      const failedStep = await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        FLOW_ID,
        3,
      )
      // Positioned between the failure and mrfStepB, but never actually run:
      // the normal action worker halts at failedStep and never enqueues it.
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        FLOW_ID,
        4,
      )
      const mrfStepB = await createMrfActionStep(5)

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
        stepId: mrfStepA.id,
        status: 'success',
        dataOut: {},
        appKey: 'formsg',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: failedStep.id,
        status: 'failure',
        dataOut: null,
        appKey: 'postman',
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: mrfStepB.id,
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

      const $ = createGlobalVariable(mrfStepB, execution)
      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    // Rule C (baseline, no if-then V2 block involved): nothing has finished
    // yet, so this must not be misread as "reached".
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
  })

  /**
   * Rule C. Region confinement lets a block end right before an MRF step, so
   * a FALSE condition can resume execution there with the block's last step
   * never run. That "missing execution step" must not be read as "not
   * reached yet".
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
      // Add an only-continue-if inside the block, between the if-then and its
      // last child.
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

  /**
   * Rule B. A top-level only-continue-if (not guarded by an if-then V2
   * block) stops the whole execution on a FALSE condition instead of
   * skipping forward. Its own execution step is still recorded as a normal
   * success, so that success must not be misread as "reached, keep going".
   */
  describe('run - previous executable step is an unguarded only-continue-if', () => {
    let onlyContinueIfStep: Step
    let mrfStep3: Step
    let execution: Execution

    beforeEach(async () => {
      const mrfStep2 = await createMrfActionStep(2)
      onlyContinueIfStep = await generateMockStep(
        context,
        'onlyContinueIf',
        'toolbox',
        'action',
        FLOW_ID,
        3,
      )
      mrfStep3 = await createMrfActionStep(4)

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
      // The next respondent has already submitted, independently of what the
      // only-continue-if decided.
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

    it('should pause execution when it resolved FALSE (stop-execution)', async () => {
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: onlyContinueIfStep.id,
        status: 'success',
        dataOut: { result: false },
        appKey: 'toolbox',
      })

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should continue when it resolved TRUE', async () => {
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: onlyContinueIfStep.id,
        status: 'success',
        dataOut: { result: true },
        appKey: 'toolbox',
      })

      const $ = createGlobalVariable(mrfStep3, execution)

      expect(await action.run($)).toBeUndefined()
    })
  })
})
