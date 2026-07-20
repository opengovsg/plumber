import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stepQueryFindOne: vi.fn(),
  stepQueryWhere: vi.fn(),
  executionStepQueryFindOne: vi.fn(),
  executionStepQueryWhere: vi.fn(),
  getDataOutMetadata: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findOne: mocks.stepQueryFindOne,
      where: mocks.stepQueryWhere,
    }),
  },
}))

vi.mock('@/models/execution-step', () => ({
  default: {
    query: () => ({
      findOne: mocks.executionStepQueryFindOne,
      where: mocks.executionStepQueryWhere,
    }),
  },
}))

vi.mock('../../common/get-data-out-metadata', () => ({
  default: mocks.getDataOutMetadata,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import action from '../../actions/mrf-submission/index'

function createMockGlobalVariable(
  overrides: Partial<Record<string, unknown>> = {},
): IGlobalVariable {
  return {
    step: {
      id: 'current-step-id',
      position: 2,
      parameters: {
        mrf: {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'workflow-step-002',
          type: 'static',
          fields: ['field-a', 'field-b'],
          approvalField: undefined,
        },
      },
    },
    flow: { id: 'flow-id' },
    app: { name: 'formsg' },
    execution: { id: 'execution-id' },
    setActionItem: vi.fn(),
    getLastExecutionStep: vi.fn(),
    ...overrides,
  } as unknown as IGlobalVariable
}

describe('mrf-submission action', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Sanity check here
  it('should have correct metadata', () => {
    expect(action.key).toBe('mrfSubmission')
    expect(action.hiddenFromUser).toBe(true)
  })

  describe('validateMrfStep', () => {
    it('should throw when mrf parameter is missing', async () => {
      const $ = createMockGlobalVariable({
        step: {
          id: 'step-id',
          position: 2,
          parameters: {},
        },
      })

      await expect(action.testRun($)).rejects.toThrow('Misconfigured MRF step')
    })

    it('should throw when mrf parameter has invalid schema', async () => {
      const $ = createMockGlobalVariable({
        step: {
          id: 'step-id',
          position: 2,
          parameters: {
            mrf: {
              invalidField: true,
            },
          },
        },
      })

      await expect(action.testRun($)).rejects.toThrow('Misconfigured MRF step')
    })
  })

  describe('testRun', () => {
    it('should set null action item (i.e. no dataOut) when trigger execution step is not found', async () => {
      const $ = createMockGlobalVariable()
      mocks.stepQueryFindOne.mockReturnValue({
        throwIfNotFound: () => ({ id: 'trigger-step-id' }),
      })
      mocks.executionStepQueryFindOne.mockResolvedValue(null)

      await action.testRun($)

      expect($.setActionItem).toHaveBeenCalledWith({ raw: null })
    })

    it('should return mock data directly when testing with mock data', async () => {
      const $ = createMockGlobalVariable()
      const mockDataOut = { field1: 'value1' }
      const mockMetadata = {
        isMock: true,
        lastTestSubmissionDate: '2024-01-01',
      }

      mocks.stepQueryFindOne.mockReturnValue({
        throwIfNotFound: () => ({ id: 'trigger-step-id' }),
      })
      mocks.executionStepQueryFindOne.mockResolvedValue({
        dataOut: mockDataOut,
        metadata: mockMetadata,
      })

      await action.testRun($)

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: mockDataOut,
        meta: mockMetadata,
      })
    })

    it('should set null action item when workflowContent is missing for non-mock submission', async () => {
      const $ = createMockGlobalVariable()
      mocks.stepQueryFindOne.mockReturnValue({
        throwIfNotFound: () => ({ id: 'trigger-step-id' }),
      })
      mocks.executionStepQueryFindOne.mockResolvedValue({
        dataOut: { someField: 'value' },
        metadata: {},
      })

      await action.testRun($)

      expect($.setActionItem).toHaveBeenCalledWith({ raw: null })
    })

    it('should set null action item when current workflow step is not yet completed', async () => {
      const $ = createMockGlobalVariable()
      mocks.stepQueryFindOne.mockReturnValue({
        throwIfNotFound: () => ({ id: 'trigger-step-id' }),
      })
      mocks.executionStepQueryFindOne.mockResolvedValue({
        dataOut: {
          workflowContent: {
            workflow: [
              { _id: 'workflow-step-001' },
              { _id: 'workflow-step-002' },
            ],
            workflowStep: 0, // only workflow-step-001 completed
            submittedSteps: [],
          },
        },
        metadata: {},
      })

      await action.testRun($)

      // workflow-step-002 is not in completed steps (only index 0)
      expect($.setActionItem).toHaveBeenCalledWith({ raw: null })
    })

    it('should return data when current workflow step is completed', async () => {
      const $ = createMockGlobalVariable()
      const mockDataOut = {
        workflowContent: {
          workflow: [
            { _id: 'workflow-step-001' },
            { _id: 'workflow-step-002' },
          ],
          workflowStep: 1, // both steps completed
          submittedSteps: [] as undefined[],
        },
      }

      mocks.stepQueryFindOne.mockReturnValue({
        throwIfNotFound: () => ({ id: 'trigger-step-id' }),
      })
      mocks.executionStepQueryFindOne.mockResolvedValue({
        dataOut: mockDataOut,
        metadata: { someKey: 'value' },
      })

      await action.testRun($)

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: mockDataOut,
        meta: { someKey: 'value' },
      })
    })
  })

  describe('run', () => {
    const PREVIOUS_STEP = { id: 'prev-step-id', position: 1 }

    /**
     * `run` loads the whole flow (`Step.query().where().orderBy()`) and then the
     * execution steps of the candidate steps
     * (`ExecutionStep.query().where().whereIn().orderBy()`). Both chains resolve
     * on `orderBy`, so that is where the rows go.
     */
    function setupRunMocks({
      flowSteps = [PREVIOUS_STEP],
      executionSteps = [],
    }: {
      flowSteps?: unknown[]
      executionSteps?: unknown[]
    } = {}) {
      const flowStepsChain = {
        orderBy: vi.fn().mockResolvedValue(flowSteps),
      }
      mocks.stepQueryWhere.mockReturnValue(flowStepsChain)

      const executionStepChain = {
        whereIn: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(executionSteps),
      }
      mocks.executionStepQueryWhere.mockReturnValue(executionStepChain)

      // Chain mock for the rejection-branch lookup, which is still one query.
      const rejectStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        andWhereRaw: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      return { flowStepsChain, executionStepChain, rejectStepChain }
    }

    function ranSuccessfully(stepId: string) {
      return { stepId, isFailed: false }
    }

    it('should throw when previous executable step is not found', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ flowSteps: [] })

      await expect(action.run($)).rejects.toThrow(
        'Previous executable step not found',
      )
    })

    it('should pause execution when previous execution step is not found', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [] })

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when previous execution step is failed', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({
        executionSteps: [{ stepId: PREVIOUS_STEP.id, isFailed: true }],
      })

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when current execution step webhook has not arrived - the next respondent has not submitted yet', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)] })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      )

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should throw when submitted steps are invalid', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)] })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: 'invalid',
          },
        },
      })

      await expect(action.run($)).rejects.toThrow(
        'Invalid MRF data: submitted steps are not valid',
      )
    })

    it('should throw when submitted step is not found', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)] })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [],
          },
        },
      })

      await expect(action.run($)).rejects.toThrow(
        'Invalid MRF data: unable to find submitted step',
      )
    })

    it('should continue when mrf step does not require approval', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)] })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: false,
                submittedAt: '2024-01-01',
              },
            ],
          },
        },
      })

      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should continue when mrf step is approved', async () => {
      const $ = createMockGlobalVariable()
      setupRunMocks({ executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)] })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
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
      })

      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should use the latest execution step of a retried previous step', async () => {
      const $ = createMockGlobalVariable()
      // Ordered created_at desc by the query, so the retry's success comes first.
      setupRunMocks({
        executionSteps: [
          ranSuccessfully(PREVIOUS_STEP.id),
          { stepId: PREVIOUS_STEP.id, isFailed: true },
        ],
      })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [{ isApproval: false, submittedAt: '2024-01-01' }],
          },
        },
      })

      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should jump to rejection branch step when rejected', async () => {
      const $ = createMockGlobalVariable()
      const { flowStepsChain, rejectStepChain } = setupRunMocks({
        executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)],
      })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: true,
                submittedAt: '2024-01-01',
                status: 'REJECTED',
              },
            ],
          },
        },
      })

      // Second Step.query(): find the rejection branch step
      rejectStepChain.first.mockResolvedValue({ id: 'reject-step-id' })
      mocks.stepQueryWhere
        .mockReturnValueOnce(flowStepsChain)
        .mockReturnValueOnce(rejectStepChain)

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: {
          command: 'jump-to-step',
          stepId: 'reject-step-id',
        },
      })
    })

    it('should stop execution when rejected but no rejection branch exists', async () => {
      const $ = createMockGlobalVariable()
      const { flowStepsChain, rejectStepChain } = setupRunMocks({
        executionSteps: [ranSuccessfully(PREVIOUS_STEP.id)],
      })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [
              {
                isApproval: true,
                submittedAt: '2024-01-01',
                status: 'REJECTED',
              },
            ],
          },
        },
      })

      // Second Step.query(): no rejection branch found
      mocks.stepQueryWhere
        .mockReturnValueOnce(flowStepsChain)
        .mockReturnValueOnce(rejectStepChain)

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'stop-execution' },
      })
    })

    it('should continue when the previous executable step was skipped by a FALSE if-then V2 block', async () => {
      const $ = createMockGlobalVariable()
      const ifThenStep = {
        id: 'if-then-id',
        position: 1,
        appKey: 'toolbox',
        key: 'ifThen',
        config: { endStepId: 'prev-step-id' },
      }
      // The block's only child is the previous executable step, so it has no
      // execution step of its own — the if-then's FALSE result is the proof.
      setupRunMocks({
        flowSteps: [ifThenStep, { ...PREVIOUS_STEP, position: 2 }],
        executionSteps: [
          {
            stepId: ifThenStep.id,
            isFailed: false,
            dataOut: { isConditionMet: false },
          },
        ],
      })
      ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
        dataOut: {
          workflowContent: {
            submittedSteps: [{ isApproval: false, submittedAt: '2024-01-01' }],
          },
        },
      })

      const result = await action.run($)

      expect(result).toBeUndefined()
    })

    it('should pause execution while a TRUE if-then V2 block is still running', async () => {
      const $ = createMockGlobalVariable()
      const ifThenStep = {
        id: 'if-then-id',
        position: 1,
        appKey: 'toolbox',
        key: 'ifThen',
        config: { endStepId: 'prev-step-id' },
      }
      // Condition met, so the block is running and its last step has not
      // finished — the workflow must not move past this MRF step yet.
      setupRunMocks({
        flowSteps: [ifThenStep, { ...PREVIOUS_STEP, position: 2 }],
        executionSteps: [
          {
            stepId: ifThenStep.id,
            isFailed: false,
            dataOut: { isConditionMet: true },
          },
        ],
      })

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })
  })
})
