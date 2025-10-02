import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateStepPositions from '@/graphql/mutations/update-step-positions'
import Step from '@/models/step'

const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'

const MOCK_STEPS = [
  {
    id: 'step-0',
    appKey: 'formsg' as const,
    key: 'newSubmission' as const,
    type: 'trigger',
    flowId: mockFlowId,
    position: 1,
    parameters: { testParam: 'value' },
  },
  {
    id: 'step-1',
    appKey: 'postman',
    key: 'sendTransactionalEmail' as const,
    type: 'action',
    flowId: mockFlowId,
    position: 2,
    parameters: { testParam: 'value' },
  },
  {
    id: 'step-2',
    appKey: 'tiles' as const,
    key: 'findSingleRow' as const,
    type: 'action',
    flowId: mockFlowId,
    position: 3,
    parameters: {},
  },
  {
    id: 'step-3',
    appKey: 'tiles' as const,
    key: 'findSingleRow' as const,
    type: 'action',
    flowId: mockFlowId,
    position: 4,
    parameters: {},
  },
  {
    id: 'step-4',
    appKey: 'slack' as const,
    key: 'findMessage' as const,
    type: 'action',
    flowId: mockFlowId,
    position: 5,
    parameters: {},
  },
] as const

describe('updateStepPositions mutation', () => {
  let context: any
  let fakeSteps: any[]
  let fakeFlow: any
  let fakeQuery: any
  let stepFindByIdSpy: ReturnType<typeof vi.fn>
  let stepPatchSpy: ReturnType<typeof vi.fn>
  let flowPatchAndFetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()

    // Set up flow patch and fetch spy first
    flowPatchAndFetchSpy = vi.fn().mockReturnValue({
      withGraphFetched: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    })
    stepPatchSpy = vi.fn().mockResolvedValue({})

    // Create fake flow object
    fakeFlow = {
      id: mockFlowId,
      active: false,
      $query: vi.fn().mockReturnValue({
        patchAndFetch: flowPatchAndFetchSpy,
      }),
    }

    // Create fake steps with flow reference
    fakeSteps = MOCK_STEPS.map((step) => ({
      ...step,
      flow: fakeFlow,
    }))

    // Mock Step.transaction
    vi.spyOn(Step, 'transaction').mockImplementation(async (callback) => {
      const trx = {
        raw: vi.fn().mockResolvedValue({}),
      } as any
      return callback(trx)
    })

    // Mock Step.query
    stepFindByIdSpy = vi.fn().mockReturnValue({
      patch: stepPatchSpy,
    })
    vi.spyOn(Step, 'query').mockReturnValue({
      findById: stepFindByIdSpy,
    } as any)

    // Fake the chained query methods on context.currentUser.$relatedQuery('steps')
    fakeQuery = {
      withGraphFetched: vi.fn().mockReturnThis(),
      whereIn: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      throwIfNotFound: vi.fn().mockResolvedValue(fakeSteps),
    }

    context = {
      currentUser: {
        $relatedQuery: vi.fn().mockReturnValue(fakeQuery),
      },
    }
  })

  it('should successfully update step positions', async () => {
    const input = {
      stepPositions: [
        {
          id: 'step-4',
          position: 2,
          type: 'action' as const,
        },
        {
          id: 'step-1',
          position: 3,
          type: 'action' as const,
        },
        {
          id: 'step-2',
          position: 4,
          type: 'action' as const,
        },
      ],
    }

    await updateStepPositions(null, { input }, context)

    // should call and update the step positions
    expect(stepFindByIdSpy).toHaveBeenCalledTimes(3)
    expect(stepPatchSpy).toHaveBeenCalledTimes(3)
    expect(stepFindByIdSpy).toHaveBeenNthCalledWith(1, 'step-4')
    expect(stepPatchSpy).toHaveBeenNthCalledWith(1, { position: 2 })
    expect(stepFindByIdSpy).toHaveBeenNthCalledWith(2, 'step-1')
    expect(stepPatchSpy).toHaveBeenNthCalledWith(2, { position: 3 })
    expect(stepFindByIdSpy).toHaveBeenNthCalledWith(3, 'step-2')
    expect(stepPatchSpy).toHaveBeenNthCalledWith(3, { position: 4 })

    // should update the flow updatedAt
    expect(flowPatchAndFetchSpy).toHaveBeenCalledWith({
      updatedAt: expect.any(String),
    })
  })

  it('should throw an error if the step ids are not found', async () => {
    // Mock throwIfNotFound to throw an error for missing steps
    fakeQuery.throwIfNotFound.mockRejectedValue(new Error('Step not found'))

    const input = {
      stepPositions: [
        {
          id: 'non-existent-id',
          position: 2,
          type: 'action' as const,
        },
      ],
    } as any

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Step not found',
    )
  })

  it('should throw an error if the steps are not action steps', async () => {
    const input = {
      stepPositions: [
        {
          id: 'step-0',
          position: 1,
          step: { id: 'step-0', type: 'trigger' as const },
        },
        {
          id: 'step-1',
          position: 2,
          step: { id: 'step-1', type: 'action' as const },
        },
      ],
    } as any

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Failed to update: must update contiguous action steps!',
    )
  })

  it('should throw an error if the step positions are not contiguous', async () => {
    const input = {
      stepPositions: [
        {
          id: 'step-1',
          position: 1,
          step: { id: 'step-1', type: 'action' as const },
        },
        {
          id: 'step-2',
          position: 3,
          step: { id: 'step-2', type: 'action' as const },
        },
      ],
    } as any

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Failed to update: must update contiguous action steps!',
    )
  })

  it('should throw an error if the step positions are out of bounds', async () => {
    const input = {
      stepPositions: [
        {
          id: 'step-1',
          position: 5,
          type: 'action' as const,
        },
        {
          id: 'step-2',
          position: 6,
          type: 'action' as const,
        },
      ],
    } as any

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Failed to update: step positions are out of bounds.',
    )
  })

  it('should throw an error if the pipe is active', async () => {
    // Set the flow to active
    fakeSteps = fakeSteps.map((step) => ({
      ...step,
      flow: {
        ...step.flow,
        active: true,
      },
    }))
    fakeQuery.throwIfNotFound.mockResolvedValue(fakeSteps)

    const input = {
      stepPositions: [
        {
          id: 'step-1',
          position: 2,
          type: 'action' as const,
        },
        {
          id: 'step-2',
          position: 3,
          type: 'action' as const,
        },
      ],
    } as any

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Pipe is active. Cannot update step in active pipe!',
    )
  })

  it('should throw an error if steps are missing from database', async () => {
    // Mock steps to return only some of the requested steps
    const partialSteps = [fakeSteps[1]] // Only return step-1, missing step-2
    fakeQuery.throwIfNotFound.mockResolvedValue(partialSteps)

    const input = {
      stepPositions: [
        {
          id: 'step-1',
          position: 2,
          type: 'action' as const,
        },
        {
          id: 'step-2',
          position: 3,
          type: 'action' as const,
        },
      ],
    }

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Failed to update: steps were not found',
    )
  })
})
