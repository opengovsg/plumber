import type { IStepConfig } from '@plumber/types'

import { raw, Transaction } from 'objection'
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import type Flow from '@/models/flow'
import type Step from '@/models/step'

import { BLOCK_END_STEP_ID } from '../../common/constants'
import {
  upgradeIfThenV1BlocksIfEnabled,
  validateEndStepOnCreateStep,
  validateEndStepWrite,
  validateFlowBlocks,
} from '../../common/validate-end-step'

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: vi.fn(),
}))

const stepPatchMocks = vi.hoisted(() => ({
  patchCalls: [] as { id: string; patch: unknown }[],
  deleteCalls: [] as string[],
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: (id: string) => ({
        patch: (patch: unknown) => {
          stepPatchMocks.patchCalls.push({ id, patch })
          return Promise.resolve()
        },
        delete: () => {
          stepPatchMocks.deleteCalls.push(id)
          return Promise.resolve()
        },
      }),
    }),
  },
}))

type Fixture = {
  id: string
  appKey?: string
  key?: string
  position: number
  config: IStepConfig
}

const trigger = (position: number): Fixture => ({
  id: `trigger${position}`,
  appKey: 'formsg',
  key: 'newSubmission',
  position,
  config: {},
})

const plain = (
  id: string,
  position: number,
  config: IStepConfig = {},
): Fixture => ({
  id,
  appKey: 'postman',
  key: 'sendTransactionalEmail',
  position,
  config,
})

const ifThen = (
  id: string,
  position: number,
  config: IStepConfig = {},
): Fixture => ({
  id,
  appKey: 'toolbox',
  key: 'ifThen',
  position,
  config,
})

const mrfSubmission = (id: string, position: number): Fixture => ({
  id,
  appKey: 'formsg',
  key: 'mrfSubmission',
  position,
  config: {},
})

const FLOW_ID = 'flow1'

// The config every step in one MRF rejection branch carries.
const REJECTION_BRANCH = { branch: 'reject', stepId: 'mrf' } as const

describe('validateEndStepWrite', () => {
  let loggerErrorSpy: MockInstance

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => null)
  })

  it('accepts a valid marker over a run of plain steps', () => {
    const block = ifThen('block', 2)
    const flowSteps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 's4',
        flowId: FLOW_ID,
      }),
    ).not.toThrow()
    expect(loggerErrorSpy).not.toHaveBeenCalled()
  })

  it('accepts a self-referencing empty block', () => {
    const block = ifThen('block', 2)
    const flowSteps = [trigger(1), block, plain('s3', 3)]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'block',
        flowId: FLOW_ID,
      }),
    ).not.toThrow()
  })

  it('accepts adjacent (non-overlapping) blocks', () => {
    const blockB = ifThen('blockB', 2)
    const blockC = ifThen('blockC', 4, { endStepId: 's5' })
    const flowSteps = [
      trigger(1),
      blockB,
      plain('s3', 3),
      blockC,
      plain('s5', 5),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'blockB',
        endStepId: 's3',
        flowId: FLOW_ID,
      }),
    ).not.toThrow()
  })

  it('rejects a target that is not an if-then', () => {
    const flowSteps = [trigger(1), plain('notIfThen', 2), plain('s3', 3)]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'notIfThen',
        endStepId: 's3',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'target-not-if-then',
      }),
    )
  })

  it('rejects a target that is missing from the flow', () => {
    const flowSteps = [trigger(1), ifThen('block', 2)]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'ghost',
        endStepId: 'block',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'target-not-if-then',
      }),
    )
  })

  it('accepts a block confined to one MRF rejection branch', () => {
    // trigger -> mrf -> [ifThen -> child] all in the same rejection branch.
    const rejection = { approval: REJECTION_BRANCH }
    const block = ifThen('block', 3, rejection)
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('child', 4, rejection),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'child',
        flowId: FLOW_ID,
      }),
    ).not.toThrow()
    expect(loggerErrorSpy).not.toHaveBeenCalled()
  })

  it('rejects a rejection-branch block reaching out of its branch', () => {
    // The endStep is back at the top level, so the block would cover the step
    // that resumes the main flow.
    const block = ifThen('block', 3, { approval: REJECTION_BRANCH })
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('child', 4, { approval: REJECTION_BRANCH }),
      plain('topLevel', 5),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'topLevel',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'approval-branch-crossed',
      }),
    )
  })

  it('rejects a block spanning two different rejection branches', () => {
    const block = ifThen('block', 3, { approval: REJECTION_BRANCH })
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('otherBranchChild', 4, {
        approval: { branch: 'reject', stepId: 'otherMrf' },
      }),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'otherBranchChild',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'approval-branch-crossed',
      }),
    )
  })

  it('accepts an empty (self-referencing) block in a rejection branch', () => {
    const block = ifThen('block', 3, { approval: REJECTION_BRANCH })
    const flowSteps = [trigger(1), mrfSubmission('mrf', 2), block]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'block',
        flowId: FLOW_ID,
      }),
    ).not.toThrow()
    expect(loggerErrorSpy).not.toHaveBeenCalled()
  })

  it('rejects an endStep that is not in the flow', () => {
    const block = ifThen('block', 2)
    const flowSteps = [trigger(1), block, plain('s3', 3)]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 'nowhere',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'end-step-not-in-flow',
      }),
    )
  })

  it('rejects an endStep positioned before the if-then', () => {
    const block = ifThen('block', 3)
    const flowSteps = [trigger(1), plain('s2', 2), block]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 's2',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'end-step-before-self',
      }),
    )
  })

  it('rejects an mrfSubmission step inside the block region', () => {
    const block = ifThen('block', 2)
    const flowSteps = [
      trigger(1),
      block,
      mrfSubmission('mrf', 3),
      plain('s4', 4),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 's4',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'mrf-step-in-region',
      }),
    )
  })

  it('rejects a top-level block reaching into a rejection branch', () => {
    const block = ifThen('block', 2)
    const flowSteps = [
      trigger(1),
      block,
      plain('approvalChild', 3, {
        approval: { branch: 'reject', stepId: 'x' },
      }),
      plain('s4', 4),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'block',
        endStepId: 's4',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'approval-branch-crossed',
      }),
    )
  })

  it('rejects overlapping (nested) new-style blocks', () => {
    // block B [2,4] contains block C [3,5] — overlap.
    const blockB = ifThen('blockB', 2)
    const blockC = ifThen('blockC', 3, { endStepId: 's5' })
    const flowSteps = [
      trigger(1),
      blockB,
      blockC,
      plain('s4', 4),
      plain('s5', 5),
    ]

    expect(() =>
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: 'blockB',
        endStepId: 's4',
        flowId: FLOW_ID,
      }),
    ).toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'end-step-write-rejected',
        reason: 'overlapping-blocks',
      }),
    )
  })
})

describe('validateFlowBlocks', () => {
  let loggerWarnSpy: MockInstance

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => null)
  })

  it('passes a flow whose blocks are all valid and non-empty', () => {
    const blockB = ifThen('blockB', 2, { endStepId: 's3' })
    const blockC = ifThen('blockC', 4, { endStepId: 's5' })
    const flowSteps = [
      trigger(1),
      blockB,
      plain('s3', 3),
      blockC,
      plain('s5', 5),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).not.toThrow()
    expect(loggerWarnSpy).not.toHaveBeenCalled()
  })

  it('ignores legacy (marker-less) if-thens', () => {
    const flowSteps = [trigger(1), ifThen('legacy', 2), plain('s3', 3)]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).not.toThrow()
    expect(loggerWarnSpy).not.toHaveBeenCalled()
  })

  it('rejects an empty (self-referencing) block', () => {
    const block = ifThen('block', 2, { endStepId: 'block' })
    const flowSteps = [trigger(1), block, plain('s3', 3)]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'empty-block',
      }),
    )
  })

  it('rejects a dangling marker', () => {
    const block = ifThen('block', 2, { endStepId: 'ghost' })
    const flowSteps = [trigger(1), block, plain('s3', 3)]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'end-step-not-in-flow',
      }),
    )
  })

  it('rejects a marker pointing before the if-then', () => {
    const block = ifThen('block', 3, { endStepId: 's2' })
    const flowSteps = [trigger(1), plain('s2', 2), block]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'end-step-before-self',
      }),
    )
  })

  it('accepts a block confined to one MRF rejection branch', () => {
    const rejection = { approval: REJECTION_BRANCH }
    const block = ifThen('block', 3, { ...rejection, endStepId: 's4' })
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('s4', 4, rejection),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).not.toThrow()
    expect(loggerWarnSpy).not.toHaveBeenCalled()
  })

  it('rejects a marked if-then whose block leaves its rejection branch', () => {
    const block = ifThen('block', 3, {
      approval: REJECTION_BRANCH,
      endStepId: 's4',
    })
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('s4', 4),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'approval-branch-crossed',
      }),
    )
  })

  it('rejects a block whose region contains an mrfSubmission step', () => {
    const block = ifThen('block', 2, { endStepId: 's4' })
    const flowSteps = [
      trigger(1),
      block,
      mrfSubmission('mrf', 3),
      plain('s4', 4),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'mrf-step-in-region',
      }),
    )
  })

  it('rejects a top-level block whose region reaches into a rejection branch', () => {
    const block = ifThen('block', 2, { endStepId: 's4' })
    const flowSteps = [
      trigger(1),
      block,
      plain('approvalChild', 3, {
        approval: { branch: 'reject', stepId: 'x' },
      }),
      plain('s4', 4),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'approval-branch-crossed',
      }),
    )
  })

  it('rejects overlapping (nested) new-style blocks', () => {
    const blockB = ifThen('blockB', 2, { endStepId: 's4' })
    const blockC = ifThen('blockC', 3, { endStepId: 's5' })
    const flowSteps = [
      trigger(1),
      blockB,
      blockC,
      plain('s4', 4),
      plain('s5', 5),
    ]

    expect(() => validateFlowBlocks(flowSteps, FLOW_ID)).toThrow()
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'publish-invalid-end-step',
        reason: 'overlapping-blocks',
      }),
    )
  })
})

describe('upgradeIfThenV1BlocksIfEnabled', () => {
  const getLdFlagValueMock = vi.mocked(getLdFlagValue)
  const trx = {} as Transaction

  const flowPositionPatchMocks = {
    patchCalls: [] as { threshold: number; patch: unknown }[],
  }

  // `stepsAfterBlankRemoval` stands in for what a real DB re-fetch would
  // return once the blank-cleanup deletes + compacts positions — only
  // consulted by tests that actually trigger a cleanup.
  function fakeFlow(
    ownerEmail: string,
    stepsAfterBlankRemoval: Fixture[] = [],
  ): Flow {
    return {
      id: FLOW_ID,
      $relatedQuery: vi.fn((relation: string) => {
        if (relation === 'user') {
          return {
            select: vi.fn().mockReturnThis(),
            throwIfNotFound: vi.fn().mockResolvedValue({ email: ownerEmail }),
          }
        }
        return {
          orderBy: vi.fn().mockResolvedValue(stepsAfterBlankRemoval),
          where: vi.fn((_column: string, _operator: string, value: number) => ({
            patch: vi.fn((patch: unknown) => {
              flowPositionPatchMocks.patchCalls.push({
                threshold: value,
                patch,
              })
              return Promise.resolve()
            }),
          })),
        }
      }),
    } as unknown as Flow
  }

  const pinPatch = (endStepId: string) => ({
    config: raw(`jsonb_set(config, '{${BLOCK_END_STEP_ID}}', ?::jsonb)`, [
      JSON.stringify(endStepId),
    ]),
  })

  const shiftPatch = () => ({ position: raw('position - 1') })

  // A leftover blank child from the V1 branch initializer: neither field set.
  const blank = (id: string, position: number): Fixture => ({
    id,
    position,
    config: {},
  })

  beforeEach(() => {
    getLdFlagValueMock.mockReset()
    stepPatchMocks.patchCalls.length = 0
    stepPatchMocks.deleteCalls.length = 0
    flowPositionPatchMocks.patchCalls.length = 0
  })

  it('returns before checking the flag when there are no V1 if-thens', async () => {
    const flowSteps = [trigger(1), plain('s2', 2)]

    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      fakeFlow('owner@example.com'),
      flowSteps,
    )

    expect(getLdFlagValueMock).not.toHaveBeenCalled()
    expect(stepPatchMocks.patchCalls).toHaveLength(0)
  })

  it('does nothing when the flag is off for the pipe owner', async () => {
    const block = ifThen('block', 2)
    const flowSteps = [trigger(1), block, plain('s3', 3)]
    getLdFlagValueMock.mockResolvedValue(false)

    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      fakeFlow('owner@example.com'),
      flowSteps,
    )

    expect(getLdFlagValueMock).toHaveBeenCalledWith(
      'feature_if_then_then',
      'owner@example.com',
      false,
    )
    expect(stepPatchMocks.patchCalls).toHaveLength(0)
  })

  it('pins every V1 if-then block to its own independently-derived endStep', async () => {
    const ifThenA = ifThen('ifThenA', 2)
    const childA = plain('childA', 3)
    const ifThenB = ifThen('ifThenB', 4)
    const childB = plain('childB', 5)
    const trailing = plain('trailing', 6)
    const flowSteps = [trigger(1), ifThenA, childA, ifThenB, childB, trailing]
    getLdFlagValueMock.mockResolvedValue(true)

    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      fakeFlow('owner@example.com'),
      flowSteps,
    )

    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'ifThenA', patch: pinPatch('childA') },
      { id: 'ifThenB', patch: pinPatch('trailing') },
    ])
  })

  it('excludes steps about to be deleted from consideration', async () => {
    const block = ifThen('block', 2)
    const flowSteps = [trigger(1), block, plain('s3', 3)]
    getLdFlagValueMock.mockResolvedValue(true)

    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      fakeFlow('owner@example.com'),
      flowSteps,
      new Set(['block']),
    )

    expect(stepPatchMocks.patchCalls).toHaveLength(0)
  })

  it('throws end-step-write-rejected when a derived extent violates region confinement', async () => {
    const block = ifThen('block', 3, { approval: REJECTION_BRANCH })
    const flowSteps = [
      trigger(1),
      mrfSubmission('mrf', 2),
      block,
      plain('topLevel', 4),
    ]
    getLdFlagValueMock.mockResolvedValue(true)

    await expect(
      upgradeIfThenV1BlocksIfEnabled(
        trx,
        fakeFlow('owner@example.com'),
        flowSteps,
      ),
    ).rejects.toThrow()
    expect(stepPatchMocks.patchCalls).toHaveLength(0)
  })

  it('deletes a lone blank member and self-references the emptied block', async () => {
    const block = ifThen('block', 2)
    const child = blank('child', 3)
    const flowSteps = [trigger(1), block, child]
    getLdFlagValueMock.mockResolvedValue(true)
    const flow = fakeFlow('owner@example.com', [trigger(1), block])

    await upgradeIfThenV1BlocksIfEnabled(trx, flow, flowSteps)

    expect(stepPatchMocks.deleteCalls).toEqual(['child'])
    expect(flowPositionPatchMocks.patchCalls).toEqual([
      { threshold: 3, patch: shiftPatch() },
    ])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('block') },
    ])
  })

  it('deletes a blank member and pins to the surviving real step', async () => {
    const block = ifThen('block', 2)
    const real = plain('real', 3)
    const child = blank('child', 4)
    const flowSteps = [trigger(1), block, real, child]
    getLdFlagValueMock.mockResolvedValue(true)
    const flow = fakeFlow('owner@example.com', [trigger(1), block, real])

    await upgradeIfThenV1BlocksIfEnabled(trx, flow, flowSteps)

    expect(stepPatchMocks.deleteCalls).toEqual(['child'])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('real') },
    ])
  })

  it('deletes multiple blank members in the same block, highest position first', async () => {
    const block = ifThen('block', 2)
    const firstBlank = blank('firstBlank', 3)
    const real = plain('real', 4)
    const secondBlank = blank('secondBlank', 5)
    const flowSteps = [trigger(1), block, firstBlank, real, secondBlank]
    getLdFlagValueMock.mockResolvedValue(true)
    const flow = fakeFlow('owner@example.com', [
      trigger(1),
      block,
      { ...real, position: 3 },
    ])

    await upgradeIfThenV1BlocksIfEnabled(trx, flow, flowSteps)

    expect(stepPatchMocks.deleteCalls).toEqual(['secondBlank', 'firstBlank'])
    expect(flowPositionPatchMocks.patchCalls).toEqual([
      { threshold: 5, patch: shiftPatch() },
      { threshold: 3, patch: shiftPatch() },
    ])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('real') },
    ])
  })

  it('does not delete a blank member the caller already excluded', async () => {
    const block = ifThen('block', 2)
    const child = blank('child', 3)
    const flowSteps = [trigger(1), block, child]
    getLdFlagValueMock.mockResolvedValue(true)
    const flow = fakeFlow('owner@example.com')

    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      flow,
      flowSteps,
      new Set(['child']),
    )

    expect(stepPatchMocks.deleteCalls).toEqual([])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('child') },
    ])
  })

  it('re-derives a later block correctly after an earlier blank removal shifts positions', async () => {
    const ifThenA = ifThen('ifThenA', 2)
    const blankA = blank('blankA', 3)
    const ifThenB = ifThen('ifThenB', 4)
    const childB = plain('childB', 5)
    const flowSteps = [trigger(1), ifThenA, blankA, ifThenB, childB]
    getLdFlagValueMock.mockResolvedValue(true)
    const flow = fakeFlow('owner@example.com', [
      trigger(1),
      ifThenA,
      { ...ifThenB, position: 3 },
      { ...childB, position: 4 },
    ])

    await upgradeIfThenV1BlocksIfEnabled(trx, flow, flowSteps)

    expect(stepPatchMocks.deleteCalls).toEqual(['blankA'])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'ifThenA', patch: pinPatch('ifThenA') },
      { id: 'ifThenB', patch: pinPatch('childB') },
    ])
  })
})

describe('validateEndStepOnCreateStep', () => {
  const trx = {} as Transaction

  const flowPositionPatchMocks = {
    patchCalls: [] as { threshold: number; patch: unknown }[],
  }

  // `stepsAfterBlankRemoval` stands in for what a real DB re-fetch would
  // return once the blank-cleanup deletes + compacts positions — the mock
  // returns `initialSteps` for the function's first `steps` fetch (its
  // pre-cleanup view) and this for every fetch after.
  function fakeFlow(
    initialSteps: Fixture[],
    stepsAfterBlankRemoval: Fixture[] = initialSteps,
  ): Flow {
    const orderByMock = vi
      .fn()
      .mockResolvedValueOnce(initialSteps)
      .mockResolvedValue(stepsAfterBlankRemoval)
    return {
      id: FLOW_ID,
      $relatedQuery: vi.fn(() => ({
        orderBy: orderByMock,
        where: vi.fn((_column: string, _operator: string, value: number) => ({
          patch: vi.fn((patch: unknown) => {
            flowPositionPatchMocks.patchCalls.push({
              threshold: value,
              patch,
            })
            return Promise.resolve()
          }),
        })),
      })),
    } as unknown as Flow
  }

  const pinPatch = (endStepId: string) => ({
    config: raw(`jsonb_set(config, '{${BLOCK_END_STEP_ID}}', ?::jsonb)`, [
      JSON.stringify(endStepId),
    ]),
  })

  const shiftPatch = () => ({ position: raw('position - 1') })

  // A leftover blank child from the V1 branch initializer: neither field set.
  const blank = (id: string, position: number): Fixture => ({
    id,
    position,
    config: {},
  })

  beforeEach(() => {
    stepPatchMocks.patchCalls.length = 0
    stepPatchMocks.deleteCalls.length = 0
    flowPositionPatchMocks.patchCalls.length = 0
  })

  it('deletes a leftover V1 blank placeholder before pinning a block reached via add-after-block', async () => {
    const block = ifThen('block', 2)
    const blankChild = blank('blankChild', 3)
    const newStep = plain('newStep', 4)
    const flow = fakeFlow(
      [trigger(1), block, blankChild, newStep],
      [trigger(1), block, { ...newStep, position: 3 }],
    )

    await validateEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId: 'block',
      previousStep: { id: 'blankChild' } as unknown as Step,
      newStep: { id: 'newStep' } as unknown as Step,
    })

    // The placeholder is deleted and positions close up around it...
    expect(stepPatchMocks.deleteCalls).toEqual(['blankChild'])
    expect(flowPositionPatchMocks.patchCalls).toEqual([
      { threshold: 3, patch: shiftPatch() },
    ])
    // ...so the block, left with no other member, self-references (an empty
    // V2 block) instead of the deleted placeholder becoming its endStep.
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('block') },
    ])
  })

  it('pins directly to a real last member, with no cleanup, when there is no blank placeholder', async () => {
    const block = ifThen('block', 2)
    const real = plain('real', 3)
    const newStep = plain('newStep', 4)
    const flow = fakeFlow([trigger(1), block, real, newStep])

    await validateEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId: 'block',
      previousStep: { id: 'real' } as unknown as Step,
      newStep: { id: 'newStep' } as unknown as Step,
    })

    expect(stepPatchMocks.deleteCalls).toEqual([])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('real') },
    ])
  })
})
