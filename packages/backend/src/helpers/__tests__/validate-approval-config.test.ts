import { IStep, IStepConfig } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stepQueryWhere: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      where: mocks.stepQueryWhere,
    }),
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { validateApprovalConfig } from '../validate-approval-config'

function createMockStep(overrides: Partial<IStep> = {}): IStep {
  return {
    id: 'step-id',
    flowId: 'flow-id',
    type: 'action',
    position: 1,
    appKey: 'testApp',
    key: 'testAction',
    parameters: {},
    config: {},
    ...overrides,
  } as unknown as IStep
}

describe('validateApprovalConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('Case 1: trigger step (no prevStep)', () => {
    it('should return valid with position 1 when prevStep is null', async () => {
      const result = await validateApprovalConfig(
        {} as IStepConfig,
        null as unknown as IStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 1,
      })
    })
  })

  describe('Case 2: prevStep has no approval config and is not MRF approval step', () => {
    it('should return valid when new step also has no approval config', async () => {
      const prevStep = createMockStep({ position: 3 })

      const result = await validateApprovalConfig({}, prevStep)

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 4,
      })
    })

    it('should return invalid when new step has approval config but prevStep does not', async () => {
      const prevStep = createMockStep({ position: 3 })

      const result = await validateApprovalConfig(
        { approval: { branch: 'reject', stepId: 'some-id' } } as IStepConfig,
        prevStep,
      )

      expect(result).toEqual({ isApprovalConfigValid: false })
    })
  })

  describe('Case 3: prevStep is part of a rejection branch', () => {
    it('should return valid when new step has same approval config as prevStep', async () => {
      const prevStep = createMockStep({
        position: 5,
        config: {
          approval: { branch: 'reject', stepId: 'approval-step-id' },
        },
      })

      const result = await validateApprovalConfig(
        {
          approval: { branch: 'reject', stepId: 'approval-step-id' },
        } as IStepConfig,
        prevStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 6,
      })
    })

    it('should return invalid when new step has different approval config', async () => {
      const prevStep = createMockStep({
        position: 5,
        config: {
          approval: { branch: 'reject', stepId: 'approval-step-id' },
        },
      })

      const result = await validateApprovalConfig(
        {
          approval: { branch: 'reject', stepId: 'different-step-id' },
        } as IStepConfig,
        prevStep,
      )

      expect(result).toEqual({ isApprovalConfigValid: false })
    })

    it('should return invalid when new step has no approval config but prevStep does', async () => {
      const prevStep = createMockStep({
        position: 5,
        config: {
          approval: { branch: 'reject', stepId: 'approval-step-id' },
        },
      })

      const result = await validateApprovalConfig({} as IStepConfig, prevStep)

      expect(result).toEqual({ isApprovalConfigValid: false })
    })
  })

  describe('Case 4: prevStep is an MRF approval step', () => {
    const mrfApprovalStep = createMockStep({
      id: 'mrf-approval-step-id',
      position: 3,
      appKey: 'formsg',
      key: 'mrfSubmission',
      parameters: {
        mrf: { approvalField: 'some-approval-field' },
      },
    })

    it('should return valid for approve branch (no approval config on new step)', async () => {
      const result = await validateApprovalConfig(
        {} as IStepConfig,
        mrfApprovalStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 4,
      })
    })

    it('should return invalid when approval config has invalid schema', async () => {
      const result = await validateApprovalConfig(
        {
          approval: { branch: 'reject', stepId: 'not-a-uuid' },
        } as IStepConfig,
        mrfApprovalStep,
      )

      expect(result).toEqual({ isApprovalConfigValid: false })
    })

    it('should return invalid when approval config stepId does not match prevStep id', async () => {
      const result = await validateApprovalConfig(
        {
          approval: {
            branch: 'reject',
            stepId: '00000000-0000-0000-0000-000000000001',
          },
        } as IStepConfig,
        mrfApprovalStep,
      )

      expect(result).toEqual({ isApprovalConfigValid: false })
    })

    it('should find correct position for reject branch when next MRF step exists', async () => {
      // First call: Step.query().where().andWhere().andWhere().andWhere().orderBy().first()
      // This finds the next MRF step
      const nextMrfStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ position: 7 }),
      }

      // Second call: Step.query().where().andWhere().orderBy().first()
      // Then conditionally .andWhere() and .first() again
      // The code calls .first() once during build (line 122), then .andWhere() (line 125), then .first() again (line 127)
      const lastApproveStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockReturnThis(),
      }
      // The final .first() call on line 127 should resolve to the step
      lastApproveStepChain.first
        .mockReturnValueOnce(lastApproveStepChain) // line 122: .first() returns the query builder
        .mockResolvedValueOnce({ position: 5 }) // line 127: .first() resolves

      mocks.stepQueryWhere
        .mockReturnValueOnce(nextMrfStepChain)
        .mockReturnValueOnce(lastApproveStepChain)

      // Use a valid UUID for the stepId
      const approvalStepWithUuid = createMockStep({
        ...mrfApprovalStep,
        id: '00000000-0000-0000-0000-000000000001',
      })

      const result = await validateApprovalConfig(
        {
          approval: {
            branch: 'reject',
            stepId: '00000000-0000-0000-0000-000000000001',
          },
        } as IStepConfig,
        approvalStepWithUuid,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 6, // lastStepOfApproveFlow.position + 1
      })
    })

    it('should use prevStep position + 1 when no approve branch steps exist', async () => {
      const nextMrfStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      // Same pattern: .first() called twice
      const lastApproveStepChain = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        first: vi.fn().mockReturnThis(),
      }
      lastApproveStepChain.first
        .mockReturnValueOnce(lastApproveStepChain) // line 122
        .mockResolvedValueOnce(null) // line 127

      mocks.stepQueryWhere
        .mockReturnValueOnce(nextMrfStepChain)
        .mockReturnValueOnce(lastApproveStepChain)

      const approvalStepWithUuid = createMockStep({
        ...mrfApprovalStep,
        id: '00000000-0000-0000-0000-000000000001',
      })

      const result = await validateApprovalConfig(
        {
          approval: {
            branch: 'reject',
            stepId: '00000000-0000-0000-0000-000000000001',
          },
        } as IStepConfig,
        approvalStepWithUuid,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 4, // prevStep.position + 1
      })
    })
  })

  describe('non-MRF formsg step', () => {
    it('should not treat formsg step without approvalField as MRF approval step', async () => {
      const prevStep = createMockStep({
        position: 3,
        appKey: 'formsg',
        key: 'mrfSubmission',
        parameters: {
          mrf: { approvalField: undefined },
        },
      })

      const result = await validateApprovalConfig({} as IStepConfig, prevStep)

      // Should hit Case 2 (no approval config, not MRF approval step)
      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 4,
      })
    })
  })
})
