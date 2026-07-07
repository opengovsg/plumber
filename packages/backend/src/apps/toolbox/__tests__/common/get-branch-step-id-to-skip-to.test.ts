import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import { getBranchStepIdToSkipTo } from '../../common/get-branch-step-id-to-skip-to'

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

describe('getBranchStepIdToSkipTo', () => {
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

    const result = await getBranchStepIdToSkipTo($ as any)
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

    const result = await getBranchStepIdToSkipTo($ as any)
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
    const result = await getBranchStepIdToSkipTo($ as any)
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
    const result = await getBranchStepIdToSkipTo($ as any)
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

    const result = await getBranchStepIdToSkipTo($ as any)
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

    const result = await getBranchStepIdToSkipTo($ as any)
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

      const result = await getBranchStepIdToSkipTo($ as any)
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

      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBe('step5')
    })
  })

  describe('new-style step to jump to (marker)', () => {
    it('returns the stored step to jump to when it points forward', async () => {
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
          parameters: { depth: '1', stepIdToJumpTo: 'step4' },
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
          parameters: { depth: '1', stepIdToJumpTo: null },
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
        flow: { id: 'flow-marker' },
        step: { id: 'step2', position: 2 },
      }
      expect(await getBranchStepIdToSkipTo($ as any)).toBe('step4')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('returns null when the last branch stores the "stop" sentinel', async () => {
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
          parameters: { depth: '1', stepIdToJumpTo: 'step4' },
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
          parameters: { depth: '1', stepIdToJumpTo: null },
          position: 4,
        },
      ])

      const $ = {
        flow: { id: 'flow-marker' },
        step: { id: 'step4', position: 4 },
      }
      expect(await getBranchStepIdToSkipTo($ as any)).toBeNull()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    // L1: an "only continue if" placed *after* the block resolves its preceding
    // if-then to the block's last branch, whose marker points back into the
    // after-block region. The forward guard must stop rather than jump — a
    // self-jump would loop forever; a backward jump would re-run earlier steps.
    it('returns null (stop) when the marker points at the current step (self-jump)', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce([
        {
          id: 'step1',
          appKey: 'formsg',
          key: 'newSubmission',
          parameters: {},
          position: 1,
        },
        // Block's last branch; its exit is the after-block OCI (step4).
        {
          id: 'step2',
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: '1', stepIdToJumpTo: 'step4' },
          position: 2,
        },
        {
          id: 'step3',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
        },
        // After-block region: the OCI is its first step (and the current step).
        {
          id: 'step4',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          parameters: {},
          position: 4,
        },
      ])

      const $ = {
        flow: { id: 'flow-after-block' },
        step: { id: 'step4', position: 4 },
      }
      expect(await getBranchStepIdToSkipTo($ as any)).toBeNull()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('returns null (stop) when the marker points before the current step (backward jump)', async () => {
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
          parameters: { depth: '1', stepIdToJumpTo: 'step4' },
          position: 2,
        },
        {
          id: 'step3',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
        },
        // After-block region: step4 first, the OCI (step5) later in the region.
        {
          id: 'step4',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 4,
        },
        {
          id: 'step5',
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          parameters: {},
          position: 5,
        },
      ])

      const $ = {
        flow: { id: 'flow-after-block' },
        step: { id: 'step5', position: 5 },
      }
      expect(await getBranchStepIdToSkipTo($ as any)).toBeNull()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('returns a dangling forward id unchanged (fails loudly downstream)', async () => {
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
          parameters: { depth: '1', stepIdToJumpTo: 'ghost' },
          position: 2,
        },
        {
          id: 'step3',
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
        },
      ])

      const $ = {
        flow: { id: 'flow-marker' },
        step: { id: 'step2', position: 2 },
      }
      // Not remapped to null: an id absent from the flow is left to
      // findById().throwIfNotFound() so a corrupt marker fails loudly.
      expect(await getBranchStepIdToSkipTo($ as any)).toBe('ghost')
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
      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBe('step4')
    })

    it('approval-branch if-then does not skip to rejection-branch if-then', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps({}, { approval: { branch: 'reject', stepId: 'mrf1' } }),
      )
      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })

    it('rejection-branch if-then skips to next rejection-branch if-then with same stepId', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps(
          { approval: { branch: 'reject', stepId: 'mrf1' } },
          { approval: { branch: 'reject', stepId: 'mrf1' } },
        ),
      )
      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBe('step4')
    })

    it('rejection-branch if-then does not skip to rejection-branch if-then with different stepId', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps(
          { approval: { branch: 'reject', stepId: 'mrf1' } },
          { approval: { branch: 'reject', stepId: 'mrf2' } },
        ),
      )
      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })

    it('rejection-branch if-then does not skip to approval-branch if-then', async () => {
      mocks.stepQueryResult.mockResolvedValueOnce(
        makeSteps({ approval: { branch: 'reject', stepId: 'mrf1' } }, {}),
      )
      const result = await getBranchStepIdToSkipTo($ as any)
      expect(result).toBeNull()
    })
  })
})
