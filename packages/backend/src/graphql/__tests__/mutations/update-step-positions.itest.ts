import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateStepPositions from '@/graphql/mutations/update-step-positions'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

// Defaults to false in beforeEach below so pre-existing tests here stay
// byte-identical; the opportunistic-upgrade tests override it per case.
const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

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
    mocks.getLdFlagValue.mockResolvedValue(false)

    // Set up flow patch and fetch spy first
    flowPatchAndFetchSpy = vi.fn().mockReturnValue({
      withGraphFetched: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue({
          steps: MOCK_STEPS,
        }),
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
      // Used by upgradeIfThenV1BlocksIfEnabled's re-fetch. MOCK_STEPS has no
      // if-then steps, so it's a no-op regardless of what this returns.
      $relatedQuery: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(MOCK_STEPS),
      }),
      assertNotUpdatedSince: vi.fn(),
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
      // Subquery builder used to scope the step load to the flow.
      select: vi.fn().mockReturnValue({ whereIn: vi.fn() }),
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
        withAccessibleSteps: vi.fn().mockReturnValue(fakeQuery),
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
      flow: {
        updatedAt: new Date().toISOString(),
      },
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
      flow: {
        updatedAt: new Date().toISOString(),
      },
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
      flow: {
        updatedAt: '2021-01-01T00:00:00.000Z',
      },
    }

    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    await expect(updateStepPositions(null, { input }, context)).rejects.toThrow(
      'Failed to update: steps were not found',
    )
  })
})

// Real-DB integration tests, kept separate from the mock-based suite above
// so the repair runs against real flow steps.
describe('updateStepPositions endStepId repair', () => {
  let testFlow: Flow
  let owner: User
  let context: Context
  let loggerInfoSpy: MockInstance

  const flowInput = () => ({
    updatedAt: new Date(testFlow.updatedAt).getTime().toString(),
  })

  async function seedSteps(
    specs: Array<{
      key: string | null
      appKey: string | null
      type: 'trigger' | 'action'
      config?: Record<string, any>
      parameters?: Record<string, any>
    }>,
  ): Promise<Step[]> {
    return testFlow.$relatedQuery('steps').insertAndFetch(
      specs.map((spec, index) => ({
        key: spec.key,
        appKey: spec.appKey,
        type: spec.type,
        position: index + 1,
        parameters: spec.parameters ?? {},
        config: spec.config ?? {},
      })),
    ) as unknown as Promise<Step[]>
  }

  const reload = async (id: string): Promise<Step> =>
    Step.query().findById(id).throwIfNotFound()

  const wasRepaired = () =>
    loggerInfoSpy.mock.calls.some(
      ([arg]) =>
        arg?.event === 'end-step-repaired' &&
        arg?.mutation === 'updateStepPositions',
    )

  beforeEach(async () => {
    vi.restoreAllMocks()
    mocks.getLdFlagValue.mockResolvedValue(false)

    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: owner,
      res: null,
      isAdminOperation: false,
    } as unknown as Context

    testFlow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Reorder Flow',
      updatedBy: owner.id,
    })

    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => null)
  })

  it('moves the endStep marker to the new highest member after an interior reorder', async () => {
    const [, ifThen, s3, s4, s5] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({ config: { endStepId: s5.id } })

    // Reorder the block interior [s3, s4, s5] -> [s5, s3, s4].
    await updateStepPositions(
      null,
      {
        input: {
          stepPositions: [
            { id: s5.id, position: 3, type: 'action' as const },
            { id: s3.id, position: 4, type: 'action' as const },
            { id: s4.id, position: 5, type: 'action' as const },
          ],
          flow: flowInput(),
        },
      },
      context,
    )

    expect((await reload(ifThen.id)).config.endStepId).toBe(s4.id)
    expect(wasRepaired()).toBe(true)
  })

  it('leaves the marker untouched when the reorder does not touch the block', async () => {
    const [, ifThen, s3, a4, a5] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({ config: { endStepId: s3.id } })

    // Reorder two later steps that sit outside the block.
    await updateStepPositions(
      null,
      {
        input: {
          stepPositions: [
            { id: a5.id, position: 4, type: 'action' as const },
            { id: a4.id, position: 5, type: 'action' as const },
          ],
          flow: flowInput(),
        },
      },
      context,
    )

    expect((await reload(ifThen.id)).config.endStepId).toBe(s3.id)
    expect(wasRepaired()).toBe(false)
  })

  it('reorders a legacy (marker-less) flow without writing any marker', async () => {
    const [, legacy, s3, s4] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])

    await updateStepPositions(
      null,
      {
        input: {
          stepPositions: [
            { id: s4.id, position: 3, type: 'action' as const },
            { id: s3.id, position: 4, type: 'action' as const },
          ],
          flow: flowInput(),
        },
      },
      context,
    )

    expect((await reload(legacy.id)).config.endStepId).toBeUndefined()
    expect(wasRepaired()).toBe(false)
  })

  describe('opportunistic if-then V1 upgrade', () => {
    // Both if-thens are legacy. Dragging ifThenB's block to before ifThenA's
    // reproduces the original bug: without pinning ifThenA's extent before
    // the drag, re-deriving it afterward (once it's the last if-then) would
    // silently balloon to include `trailing`.
    async function seedTwoBlockFlow() {
      return seedSteps([
        { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
        { key: 'ifThen', appKey: 'toolbox', type: 'action' },
        { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
        { key: 'ifThen', appKey: 'toolbox', type: 'action' },
        { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
        { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      ])
    }

    const swapBlocksInput = (
      ifThenB: Step,
      childB: Step,
      ifThenA: Step,
      childA: Step,
    ) => ({
      stepPositions: [
        { id: ifThenB.id, position: 2, type: 'action' as const },
        { id: childB.id, position: 3, type: 'action' as const },
        { id: ifThenA.id, position: 4, type: 'action' as const },
        { id: childA.id, position: 5, type: 'action' as const },
      ],
      flow: flowInput(),
    })

    it('pins both legacy blocks to their pre-reorder extents so the drag does not absorb the trailing step', async () => {
      const [, ifThenA, childA, ifThenB, childB, trailing] =
        await seedTwoBlockFlow()
      mocks.getLdFlagValue.mockResolvedValue(true)

      await updateStepPositions(
        null,
        { input: swapBlocksInput(ifThenB, childB, ifThenA, childA) },
        context,
      )

      // ifThenA's block stays pinned to just childA. `trailing` is not
      // absorbed into it, even though ifThenA is now the last if-then.
      expect((await reload(ifThenA.id)).config.endStepId).toBe(childA.id)
      expect((await reload(ifThenB.id)).config.endStepId).toBeDefined()
      expect((await reload(trailing.id)).config.endStepId).toBeUndefined()
    })

    it('does not pin any V1 if-then block when the flag is off', async () => {
      const [, ifThenA, childA, ifThenB, childB] = await seedTwoBlockFlow()
      mocks.getLdFlagValue.mockResolvedValue(false)

      await updateStepPositions(
        null,
        { input: swapBlocksInput(ifThenB, childB, ifThenA, childA) },
        context,
      )

      expect((await reload(ifThenA.id)).config.endStepId).toBeUndefined()
      expect((await reload(ifThenB.id)).config.endStepId).toBeUndefined()
    })
  })
})
