import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest'

import logger from '@/helpers/logger'

import {
  getIfThenV1StepIdToSkipTo,
  getStepIdToSkipTo,
} from '../../common/get-step-id-to-skip-to'

const mocks = vi.hoisted(() => ({
  stepQueryResult: vi.fn().mockResolvedValue([
    {
      id: 'step1',
      appKey: 'formsg',
      key: 'newSubmission',
      parameters: {},
      position: 1,
    },
    {
      id: 'step2',
      appKey: 'toolbox',
      key: 'ifThen',
      parameters: { depth: '1' },
      position: 2,
    },
    {
      id: 'step3',
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      position: 3,
    },
    {
      id: 'step4',
      appKey: 'toolbox',
      key: 'ifThen',
      parameters: { depth: '1' },
      position: 4,
    },
    {
      id: 'step5',
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      position: 5,
    },
  ]),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    throwIfNotFound: mocks.stepQueryResult,
  },
}))

describe('getIfThenV1StepIdToSkipTo', () => {
  let consoleErrorSpy: MockInstance
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => null)
  })

  it('should return the next branch step if found', async () => {
    const $ = {
      flow: { id: 'flow1' },
      step: {
        id: 'step2',
        position: 2,
      },
    }

    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBe('step4')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should return null if last ifThen branch is reached', async () => {
    const $ = {
      flow: { id: 'flow2' },
      step: {
        id: 'step4',
        position: 4,
      },
    }

    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('defaults currDepth to 0 and returns null if the current branch step has an invalid depth', async () => {
    mocks.stepQueryResult.mockResolvedValue([
      {
        id: 'step1',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
        position: 1,
      },
      {
        id: 'step2',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: 'blah' },
        position: 2,
      },
      {
        id: 'step3',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
      },
      {
        id: 'step4',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: 2 },
        position: 4,
      },
      {
        id: 'step5',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 5,
      },
    ])

    const $ = {
      flow: { id: 'flow3' },
      step: {
        id: 'step2',
        position: 2,
      },
    }

    // currDepth defaults to 0; step4 has depth 2 which is > 0, so no next branch matches
    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('defaults to 0 if the next branch step has an invalid depth', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce([
      {
        id: 'step1',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
        position: 1,
      },
      {
        id: 'step2',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        position: 2,
      },
      {
        id: 'step3',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
      },
      {
        id: 'step4',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: NaN },
        position: 4,
      },
      {
        id: 'step5',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 5,
      },
    ])

    const $ = {
      flow: { id: 'flow3' },
      step: {
        id: 'step2',
        position: 2,
      },
    }
    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBe('step4')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should return the next branch step even if there are multiple steps with the same position', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce([
      {
        id: 'step1',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
        position: 1,
      },
      {
        id: 'step2',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        position: 2,
      },
      {
        id: 'step3',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
      },
      {
        id: 'step4',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        position: 3,
      },
      {
        id: 'step5',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
      },
      {
        id: 'step6',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        position: 4,
      },
      {
        id: 'step7',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 5,
      },
    ])

    const $ = {
      flow: { id: 'flow4' },
      step: {
        id: 'step4',
        position: 3,
      },
    }

    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBe('step6')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should not return the next branch step if it has a greater depth', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce([
      {
        id: 'step1',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
        position: 1,
      },
      {
        id: 'step2',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        position: 2,
      },
      {
        id: 'step3',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
      },
      {
        id: 'step4',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '2' },
        position: 4,
      },
      {
        id: 'step5',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 5,
      },
    ])

    const $ = {
      flow: { id: 'flow5' },
      step: {
        id: 'step2',
        position: 2,
      },
    }

    const result = await getIfThenV1StepIdToSkipTo($ as any)
    expect(result).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  describe('only continue if', () => {
    it('should not skip to the next branch step if the current step is "only continue if" step', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce([
        {
          id: 'step1',
          appKey: 'formsg',
          key: 'newSubmission',
          parameters: {},
          position: 1,
        },
        {
          id: 'step2',
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: '1' },
          position: 2,
        },
        {
          id: 'step3',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          parameters: {},
          position: 3,
        },
        {
          id: 'step4',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 4,
        },
        {
          id: 'step5',
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: '1' },
          position: 5,
        },
        {
          id: 'step6',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 6,
        },
      ])

      const $ = {
        flow: { id: 'flow6' },
        step: {
          id: 'step3',
          position: 3,
        },
      }

      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBe('step5')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
    it('should return undefined if only continue if step is not in an if-then branch', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce([
        {
          id: 'step1',
          appKey: 'formsg',
          key: 'newSubmission',
          parameters: {},
          position: 1,
        },

        {
          id: 'step2',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          parameters: {},
          position: 2,
        },
        {
          id: 'step3',
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: '1' },
          position: 3,
        },
        {
          id: 'step3',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 4,
        },
        {
          id: 'step5',
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: '1' },
          position: 5,
        },
        {
          id: 'step6',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 6,
        },
      ])

      const $ = {
        flow: { id: 'flow6' },
        step: {
          id: 'step3',
          position: 3,
        },
      }

      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBe('step5')
    })
  })

  describe('MRF approval flows', () => {
    const makeSteps = (step2Config: object, step4Config: object) => [
      {
        id: 'step1',
        appKey: 'formsg',
        key: 'newSubmission',
        parameters: {},
        config: {},
        position: 1,
      },
      {
        id: 'step2',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        config: step2Config,
        position: 2,
      },
      {
        id: 'step3',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        config: {},
        position: 3,
      },
      {
        id: 'step4',
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { depth: '1' },
        config: step4Config,
        position: 4,
      },
      {
        id: 'step5',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        config: {},
        position: 5,
      },
    ]

    const $ = { flow: { id: 'flow-mrf' }, step: { id: 'step2', position: 2 } }

    it('approval-branch if-then skips to next approval-branch if-then', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(makeSteps({}, {}))
      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBe('step4')
    })

    it('approval-branch if-then does not skip to rejection-branch if-then', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps({}, { approval: { branch: 'reject', stepId: 'mrf1' } }),
      )
      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })

    it('rejection-branch if-then skips to next rejection-branch if-then with same stepId', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps(
          { approval: { branch: 'reject', stepId: 'mrf1' } },
          { approval: { branch: 'reject', stepId: 'mrf1' } },
        ),
      )
      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBe('step4')
    })

    it('rejection-branch if-then does not skip to rejection-branch if-then with different stepId', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps(
          { approval: { branch: 'reject', stepId: 'mrf1' } },
          { approval: { branch: 'reject', stepId: 'mrf2' } },
        ),
      )
      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })

    it('rejection-branch if-then does not skip to approval-branch if-then', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps({ approval: { branch: 'reject', stepId: 'mrf1' } }, {}),
      )
      const result = await getIfThenV1StepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })
  })
})

describe('getStepIdToSkipTo (new-style dispatch)', () => {
  let loggerErrorSpy: MockInstance

  beforeEach(() => {
    // The new dispatch fails loud via logger.error (not console.error); spy so
    // we can both silence and assert the structured events.
    loggerErrorSpy = vi
      .spyOn(logger, 'error')
      .mockImplementation((() => logger) as any)
  })

  afterEach(() => {
    // Restore only the logger spy — vi.restoreAllMocks() would also strip the
    // module-level Step.query mockReturnThis chain and break sibling tests.
    loggerErrorSpy.mockRestore()
  })

  const FLOW_ID = 'flow-new'

  // $ for an if-then step (condition already evaluated FALSE by the action).
  // $.step is the trimmed execution object — no config, no endStepId; the
  // dispatch reads the marker off the step's own flow-steps row.
  const ifThen$ = (id = 'blk', position = 2) =>
    ({
      flow: { id: FLOW_ID },
      step: {
        id,
        appKey: 'toolbox',
        key: 'ifThen',
        position,
        parameters: {},
      },
    } as any)

  // $ for an only-continue-if step.
  const oci$ = (id: string, position: number) =>
    ({
      flow: { id: FLOW_ID },
      step: {
        id,
        appKey: 'toolbox',
        key: 'onlyContinueIf',
        position,
        parameters: {},
      },
    } as any)

  describe('when an if-then condition is FALSE', () => {
    it('resumes after the block endStep via getNextStep', async () => {
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: {},
        getNextStep: vi.fn().mockResolvedValue({ id: 'after-block' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'blk-last' },
        },
        {
          id: 'blk-a',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        endStep,
        {
          id: 'after-block',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(ifThen$())

      expect(result).toBe('after-block')
      expect(endStep.getNextStep).toHaveBeenCalledOnce()
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })

    it('treats an empty block (self-referential endStep) as positional fall-through', async () => {
      const selfBlock = {
        id: 'blk',
        appKey: 'toolbox',
        key: 'ifThen',
        position: 2,
        config: { endStepId: 'blk' },
        getNextStep: vi.fn().mockResolvedValue({ id: 'next-step' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        selfBlock,
        {
          id: 'next-step',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(ifThen$())

      expect(result).toBe('next-step')
      expect(selfBlock.getNextStep).toHaveBeenCalledOnce()
    })

    it('stops execution when the block ends the flow', async () => {
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
        config: {},
        getNextStep: vi.fn().mockResolvedValue(undefined),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'blk-last' },
        },
        endStep,
      ])

      const result = await getStepIdToSkipTo(ifThen$())

      expect(result).toBeNull()
    })

    it('throws and logs when endStepId is dangling', async () => {
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'ghost' },
        },
        {
          id: 'blk-a',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ])

      await expect(getStepIdToSkipTo(ifThen$())).rejects.toThrow(/dangling/i)
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'if-then-dangling-end-step' }),
      )
    })

    it('throws and logs when the endStep is positioned before the if-then', async () => {
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'early',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'early' },
        },
      ])

      await expect(getStepIdToSkipTo(ifThen$())).rejects.toThrow()
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'if-then-end-step-before-self' }),
      )
    })

    it('resumes after the block when it lives in an MRF rejection branch', async () => {
      const rejection = { approval: { branch: 'reject', stepId: 'mrf1' } }
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: rejection,
        // Still inside the branch, so getNextStep hands back the next member.
        getNextStep: vi.fn().mockResolvedValue({ id: 'after-block' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'mrf1',
          appKey: 'formsg',
          key: 'mrfSubmission',
          position: 2,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: { ...rejection, endStepId: 'blk-last' },
          parameters: { depth: 0 },
        },
        endStep,
      ])

      const result = await getStepIdToSkipTo(ifThen$('blk', 3))

      expect(result).toBe('after-block')
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })

    it('stops when a rejection-branch block ends at the edge of its branch', async () => {
      // getNextStep is MRF-aware: the step after this endStep leaves the
      // rejection branch, so it returns nothing and execution stops rather than
      // jumping back into the main flow.
      const rejection = { approval: { branch: 'reject', stepId: 'mrf1' } }
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: rejection,
        getNextStep: vi.fn().mockResolvedValue(undefined),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'mrf1',
          appKey: 'formsg',
          key: 'mrfSubmission',
          position: 2,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: { ...rejection, endStepId: 'blk-last' },
          parameters: { depth: 0 },
        },
        endStep,
        {
          id: 'top-level',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(ifThen$('blk', 3))

      expect(result).toBeNull()
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })

    it('delegates a legacy (marker-less) if-then to the depth-scan engine', async () => {
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'b1',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: { depth: 0 },
        },
        {
          id: 'a',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          id: 'b2',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 4,
          config: {},
          parameters: { depth: 0 },
        },
        {
          id: 'c',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(ifThen$('b1', 2))

      expect(result).toBe('b2')
    })

    it('resolves in-body when the block sits inside a for-each body', async () => {
      const endStep = {
        id: 'body-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: {},
        getNextStep: vi.fn().mockResolvedValue({ id: 'body-after' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'foreach',
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: { endStepId: 'body-last' },
        },
        endStep,
        {
          id: 'body-after',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(ifThen$('blk', 3))

      expect(result).toBe('body-after')
    })
  })

  describe('when an only-continue-if condition is FALSE', () => {
    it('stops when there is no preceding if-then', async () => {
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 2,
          config: {},
          parameters: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: { endStepId: 'blk' },
        },
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 2))
      expect(result).toBeNull()
    })

    it('delegates to the legacy engine when the governing if-then is legacy', async () => {
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'b1',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: { depth: 0 },
        },
        {
          id: 'a',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 4,
          config: {},
          parameters: {},
        },
        {
          id: 'b2',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 5,
          config: {},
          parameters: { depth: 0 },
        },
        {
          id: 'c',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 6,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 4))
      expect(result).toBe('b2')
    })

    it('resumes after the enclosing new-style block', async () => {
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: {},
        getNextStep: vi.fn().mockResolvedValue({ id: 'after-block' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'blk-last' },
        },
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 3,
          config: {},
          parameters: {},
        },
        endStep,
        {
          id: 'after-block',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 3))
      expect(result).toBe('after-block')
      expect(endStep.getNextStep).toHaveBeenCalledOnce()
    })

    it('stops (block-scoped abort) when positioned after a non-enclosing new-style block', async () => {
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 3,
        config: {},
        getNextStep: vi.fn(),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'blk-last' },
        },
        endStep,
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 4,
          config: {},
          parameters: {},
        },
        {
          id: 'after-block',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 5,
          config: {},
        },
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 4))
      expect(result).toBeNull()
      expect(endStep.getNextStep).not.toHaveBeenCalled()
    })

    it('stops when enclosed by a new-style block that ends the flow', async () => {
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: {},
        getNextStep: vi.fn().mockResolvedValue(undefined),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { endStepId: 'blk-last' },
        },
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 3,
          config: {},
          parameters: {},
        },
        endStep,
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 3))
      expect(result).toBeNull()
    })

    it('aborts to after the block when the governing block is in a rejection branch', async () => {
      const rejection = { approval: { branch: 'reject', stepId: 'mrf1' } }
      const endStep = {
        id: 'blk-last',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 4,
        config: rejection,
        getNextStep: vi.fn().mockResolvedValue({ id: 'after-block' }),
      }
      mocks.stepQueryResult.mockResolvedValue([
        {
          id: 'trigger',
          appKey: 'formsg',
          key: 'newSubmission',
          position: 1,
          config: {},
        },
        {
          id: 'blk',
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: { ...rejection, endStepId: 'blk-last' },
          parameters: { depth: 0 },
        },
        {
          id: 'oci',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          position: 3,
          config: rejection,
          parameters: {},
        },
        endStep,
      ])

      const result = await getStepIdToSkipTo(oci$('oci', 3))
      expect(result).toBe('after-block')
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })
  })
})
