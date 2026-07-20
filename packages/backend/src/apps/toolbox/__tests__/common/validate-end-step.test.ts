import type { IStepConfig } from '@plumber/types'

import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import logger from '@/helpers/logger'

import { validateEndStepWrite } from '../../common/validate-end-step'

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
