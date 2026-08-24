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
    function setupRunMocks() {
      // Chain mocks for Step.query().where().andWhere()...
      const stepChain = {
        andWhere: vi.fn().mockReturnThis(),
        andWhereRaw: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn(),
      }
      mocks.stepQueryWhere.mockReturnValue(stepChain)

      // Chain mocks for ExecutionStep.query().where().andWhere()...
      const executionStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn(),
      }
      mocks.executionStepQueryWhere.mockReturnValue(executionStepChain)

      return { stepChain, executionStepChain }
    }

    it('should throw when previous executable step is not found', async () => {
      const $ = createMockGlobalVariable()
      const { stepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue(null)

      await expect(action.run($)).rejects.toThrow(
        'Previous executable step not found',
      )
    })

    it('should pause execution when previous execution step is not found', async () => {
      const $ = createMockGlobalVariable()
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue(null)

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when previous execution step is failed', async () => {
      const $ = createMockGlobalVariable()
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: true })

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'pause-execution' },
      })
    })

    it('should pause execution when current execution step webhook has not arrived - the next respondent has not submitted yet', async () => {
      const $ = createMockGlobalVariable()
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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
      const { stepChain, executionStepChain } = setupRunMocks()
      stepChain.first.mockResolvedValue({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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

    it('should jump to rejection branch step when rejected', async () => {
      const $ = createMockGlobalVariable()
      const { stepChain, executionStepChain } = setupRunMocks()

      // First call: find previous executable step
      stepChain.first.mockResolvedValueOnce({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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

      // Second call: find rejection branch step
      const rejectStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        andWhereRaw: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'reject-step-id' }),
      }
      mocks.stepQueryWhere
        .mockReturnValueOnce(stepChain)
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
      const { stepChain, executionStepChain } = setupRunMocks()

      stepChain.first.mockResolvedValueOnce({ id: 'prev-step-id' })
      executionStepChain.first.mockResolvedValue({ isFailed: false })
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

      // Second call: no rejection branch found
      const rejectStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        andWhereRaw: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }
      mocks.stepQueryWhere
        .mockReturnValueOnce(stepChain)
        .mockReturnValueOnce(rejectStepChain)

      const result = await action.run($)

      expect(result).toEqual({
        nextStep: { command: 'stop-execution' },
      })
    })
  })
})
