import type { IStep } from '@plumber/types'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildStepsList,
  deriveIfThenV1EndStep,
  hasIfThenV2Block,
  isBlankPlaceholderStep,
  isStepInsideForEachBody,
  isStepInsideIfThenBlock,
} from '../steps-utils'

//
// Fixtures. buildStepsList and its companions operate on the MRF-filtered
// action-step list (the trigger already removed), ordered by position, so these
// fixtures never include a trigger.
//

const plain = (id: string): IStep =>
  ({ id, appKey: 'postman', key: 'sendTransactionalEmail' } as IStep)

const ifThen = (id: string, extra: Partial<IStep> = {}): IStep =>
  ({
    id,
    appKey: 'toolbox',
    key: 'ifThen',
    parameters: { depth: '0' },
    ...extra,
  } as IStep)

const markedIfThen = (id: string, endStepId: string): IStep =>
  ifThen(id, { config: { endStepId } })

// A marker-less if-then exactly as GraphQL delivers one: a response carries
// every field the query selected, so the key is present and null. IStepConfig
// describes the backend's own DB shape, where the key is simply absent, hence
// the cast.
const nullMarkerIfThen = (id: string): IStep =>
  ifThen(id, { config: { endStepId: null } as unknown as IStep['config'] })

const forEach = (id: string): IStep =>
  ({ id, appKey: 'toolbox', key: 'forEach' } as IStep)

const mrfSubmission = (id: string): IStep =>
  ({ id, appKey: 'formsg', key: 'mrfSubmission' } as IStep)

// A leftover blank child from the if-then V1 branch initializer: neither
// appKey nor key ever set.
const blank = (id: string): IStep => ({ id } as IStep)

// The set of grouping actions (`groupsLaterSteps`) is exactly if-then and
// for-each today.
const GROUPING_ACTIONS = new Set(['toolbox-ifThen', 'toolbox-forEach'])

describe('deriveIfThenV1EndStep', () => {
  it('derives a 2-branch block up to the step before the next if-then', () => {
    const ifThenA = ifThen('ifThenA')
    const ifThenB = ifThen('ifThenB')
    const steps = [ifThenA, plain('stepA'), ifThenB, plain('stepB')]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
  })

  it('derives extents for each branch of a 3-branch block', () => {
    const ifThenA = ifThen('ifThenA')
    const ifThenB = ifThen('ifThenB')
    const ifThenC = ifThen('ifThenC')
    const steps = [
      ifThenA,
      plain('stepA'),
      ifThenB,
      plain('stepB'),
      ifThenC,
      plain('stepC'),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
    expect(deriveIfThenV1EndStep(steps, ifThenC).id).toBe('stepC')
  })

  it('runs to the end of the list when there is no following if-then', () => {
    const ifThenA = ifThen('ifThenA')
    const steps = [ifThenA, plain('stepA'), plain('stepB'), plain('stepC')]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepC')
  })

  it('returns the if-then itself (self-ref) for an empty block abutting the next if-then', () => {
    const ifThenA = ifThen('ifThenA')
    const steps = [ifThenA, ifThen('ifThenB'), plain('stepB')]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('ifThenA')
  })

  it('treats a following if-then as a boundary across an MRF submission step', () => {
    const ifThenA = ifThen('ifThenA')
    const rejectIfThen = ifThen('rejectIfThen', {
      config: { approval: { branch: 'reject', stepId: 'ifThenA' } },
    })
    const steps = [
      ifThenA,
      plain('stepA'),
      mrfSubmission('mrf'),
      rejectIfThen,
      plain('stepAfter'),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('mrf')
  })

  it('skips a deeper (nested) if-then when scanning for the boundary', () => {
    const ifThenA = ifThen('ifThenA')
    const nested = ifThen('nested', { parameters: { depth: '1' } })
    const ifThenB = ifThen('ifThenB')
    const steps = [
      ifThenA,
      plain('stepA'),
      nested,
      plain('stepB'),
      ifThenB,
      plain('stepC'),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepB')
  })
})

describe('buildStepsList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns plain steps as single-step items', () => {
    const s1 = plain('s1')
    const s2 = plain('s2')

    expect(buildStepsList([s1, s2], GROUPING_ACTIONS)).toEqual([
      { type: 'step', step: s1 },
      { type: 'step', step: s2 },
    ])
  })

  it('builds an explicit if-then V2 block over a run of plain steps', () => {
    const block = markedIfThen('block', 's3')
    const s2 = plain('s2')
    const s3 = plain('s3')
    const s4 = plain('s4')

    expect(buildStepsList([block, s2, s3, s4], GROUPING_ACTIONS)).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: block,
        children: [s2, s3],
        endStepId: 's3',
        endStep: s3,
        isExplicit: true,
        isDangling: false,
      },
      { type: 'step', step: s4 },
    ])
  })

  it('treats a null marker as marker-less: GraphQL always sends the key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // A null marker means if-then V1, not a corrupt if-then V2, so no
    // warning is expected.
    const ifThenA = nullMarkerIfThen('ifThenA')
    const s2 = plain('s2')
    const ifThenB = nullMarkerIfThen('ifThenB')
    const s4 = plain('s4')

    expect(
      buildStepsList([ifThenA, s2, ifThenB, s4], GROUPING_ACTIONS),
    ).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenA,
        children: [s2],
        endStepId: 's2',
        endStep: s2,
        isExplicit: false,
        isDangling: false,
      },
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenB,
        children: [s4],
        endStepId: 's4',
        endStep: s4,
        isExplicit: false,
        isDangling: false,
      },
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('builds an empty explicit block (self-referencing marker)', () => {
    const block = markedIfThen('block', 'block')
    const s2 = plain('s2')

    expect(buildStepsList([block, s2], GROUPING_ACTIONS)).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: block,
        children: [],
        endStepId: 'block',
        endStep: block,
        isExplicit: true,
        isDangling: false,
      },
      { type: 'step', step: s2 },
    ])
  })

  it('flags a marker pointing at a missing step as dangling and falls back to the derived extent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const block = markedIfThen('block', 'ghost')
    const s2 = plain('s2')
    const s3 = plain('s3')

    // No following if-then, so the derived extent runs to the end of the list.
    expect(buildStepsList([block, s2, s3], GROUPING_ACTIONS)).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: block,
        children: [s2, s3],
        endStepId: 's3',
        endStep: s3,
        isExplicit: false,
        isDangling: true,
      },
    ])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('flags a marker pointing before the if-then as dangling and falls back to the derived extent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const s1 = plain('s1')
    const block = markedIfThen('block', 's1')

    // No following if-then, so the derived extent self-references as an
    // empty block.
    expect(buildStepsList([s1, block], GROUPING_ACTIONS)).toEqual([
      { type: 'step', step: s1 },
      {
        type: 'ifThenBlock',
        ifThenStep: block,
        children: [],
        endStepId: 'block',
        endStep: block,
        isExplicit: false,
        isDangling: true,
      },
    ])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('builds if-then V1 (marker-less) blocks with parity to the derived extent', () => {
    const ifThenA = ifThen('ifThenA')
    const sA = plain('sA')
    const ifThenB = ifThen('ifThenB')
    const sB = plain('sB')

    expect(
      buildStepsList([ifThenA, sA, ifThenB, sB], GROUPING_ACTIONS),
    ).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenA,
        children: [sA],
        endStepId: 'sA',
        endStep: sA,
        isExplicit: false,
        isDangling: false,
      },
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenB,
        children: [sB],
        endStepId: 'sB',
        endStep: sB,
        isExplicit: false,
        isDangling: false,
      },
    ])
  })

  it('builds an empty if-then V1 block abutting the next if-then', () => {
    const ifThenA = ifThen('ifThenA')
    const ifThenB = ifThen('ifThenB')
    const sB = plain('sB')

    const result = buildStepsList([ifThenA, ifThenB, sB], GROUPING_ACTIONS)

    expect(result).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenA,
        children: [],
        endStepId: 'ifThenA',
        endStep: ifThenA,
        isExplicit: false,
        isDangling: false,
      },
      {
        type: 'ifThenBlock',
        ifThenStep: ifThenB,
        children: [sB],
        endStepId: 'sB',
        endStep: sB,
        isExplicit: false,
        isDangling: false,
      },
    ])
  })

  it('interleaves plain steps with if-then V1 and V2 blocks', () => {
    const p0 = plain('p0')
    const v1If = ifThen('v1If')
    const l1 = plain('l1')
    const v2If = markedIfThen('v2If', 'n2')
    const n1 = plain('n1')
    const n2 = plain('n2')
    const pAfter = plain('pAfter')

    expect(
      buildStepsList([p0, v1If, l1, v2If, n1, n2, pAfter], GROUPING_ACTIONS),
    ).toEqual([
      { type: 'step', step: p0 },
      {
        type: 'ifThenBlock',
        ifThenStep: v1If,
        children: [l1],
        endStepId: 'l1',
        endStep: l1,
        isExplicit: false,
        isDangling: false,
      },
      {
        type: 'ifThenBlock',
        ifThenStep: v2If,
        children: [n1, n2],
        endStepId: 'n2',
        endStep: n2,
        isExplicit: true,
        isDangling: false,
      },
      { type: 'step', step: pAfter },
    ])
  })

  it('honours the marker on an if-then inside an MRF rejection branch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // A block inside a rejection branch is an ordinary if-then V2 block,
    // with no special-casing.
    const approvalIf = ifThen('approvalIf', {
      config: {
        approval: { branch: 'reject', stepId: 'someApprovalStep' },
        endStepId: 's2',
      },
    })
    const s2 = plain('s2')
    const s3 = plain('s3')

    expect(buildStepsList([approvalIf, s2, s3], GROUPING_ACTIONS)).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: approvalIf,
        children: [s2],
        endStepId: 's2',
        endStep: s2,
        isExplicit: true,
        isDangling: false,
      },
      { type: 'step', step: s3 },
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('still derives the extent of a marker-less if-then in a rejection branch', () => {
    // Existing if-then V1 blocks inside rejection branches keep working.
    const approvalIf = ifThen('approvalIf', {
      config: { approval: { branch: 'reject', stepId: 'someApprovalStep' } },
    })
    const s2 = plain('s2')
    const s3 = plain('s3')

    expect(buildStepsList([approvalIf, s2, s3], GROUPING_ACTIONS)).toEqual([
      {
        type: 'ifThenBlock',
        ifThenStep: approvalIf,
        children: [s2, s3],
        endStepId: 's3',
        endStep: s3,
        isExplicit: false,
        isDangling: false,
      },
    ])
  })

  it('lets a for-each block swallow all later steps', () => {
    const forEachStep = forEach('forEach')
    const s1 = plain('s1')
    const s2 = plain('s2')

    expect(buildStepsList([forEachStep, s1, s2], GROUPING_ACTIONS)).toEqual([
      {
        type: 'forEachBlock',
        forEachStep,
        children: [
          { type: 'step', step: s1 },
          { type: 'step', step: s2 },
        ],
      },
    ])
  })

  it('recurses into a for-each body so if-then blocks render inside it', () => {
    const forEachStep = forEach('forEach')
    const s1 = plain('s1')
    const v2If = markedIfThen('v2If', 'n2')
    const n1 = plain('n1')
    const n2 = plain('n2')

    expect(
      buildStepsList([forEachStep, s1, v2If, n1, n2], GROUPING_ACTIONS),
    ).toEqual([
      {
        type: 'forEachBlock',
        forEachStep,
        children: [
          { type: 'step', step: s1 },
          {
            type: 'ifThenBlock',
            ifThenStep: v2If,
            children: [n1, n2],
            endStepId: 'n2',
            endStep: n2,
            isExplicit: true,
            isDangling: false,
          },
        ],
      },
    ])
  })
})

describe('isStepInsideIfThenBlock', () => {
  it('is true for a member of an if-then block, including its endStep', () => {
    const p0 = plain('p0')
    const block = markedIfThen('block', 'b2')
    const b1 = plain('b1')
    const b2 = plain('b2')
    const pAfter = plain('pAfter')
    const steps = [p0, block, b1, b2, pAfter]

    expect(isStepInsideIfThenBlock(b1, steps, GROUPING_ACTIONS)).toBe(true)
    expect(isStepInsideIfThenBlock(b2, steps, GROUPING_ACTIONS)).toBe(true)
  })

  it('is false for the if-then step itself and for steps outside any block', () => {
    const p0 = plain('p0')
    const block = markedIfThen('block', 'b2')
    const b1 = plain('b1')
    const b2 = plain('b2')
    const pAfter = plain('pAfter')
    const steps = [p0, block, b1, b2, pAfter]

    expect(isStepInsideIfThenBlock(block, steps, GROUPING_ACTIONS)).toBe(false)
    expect(isStepInsideIfThenBlock(p0, steps, GROUPING_ACTIONS)).toBe(false)
    expect(isStepInsideIfThenBlock(pAfter, steps, GROUPING_ACTIONS)).toBe(false)
  })

  it('is true for a member of an if-then block nested in a for-each body', () => {
    const forEachStep = forEach('forEach')
    const s1 = plain('s1')
    const v2If = markedIfThen('v2If', 'n2')
    const n1 = plain('n1')
    const n2 = plain('n2')
    const steps = [forEachStep, s1, v2If, n1, n2]

    expect(isStepInsideIfThenBlock(n1, steps, GROUPING_ACTIONS)).toBe(true)
    // A direct for-each child that is not inside an if-then.
    expect(isStepInsideIfThenBlock(s1, steps, GROUPING_ACTIONS)).toBe(false)
  })
})

describe('isStepInsideForEachBody', () => {
  it('is true for any step within a for-each body, at any depth', () => {
    const forEachStep = forEach('forEach')
    const s1 = plain('s1')
    const v2If = markedIfThen('v2If', 'n2')
    const n1 = plain('n1')
    const n2 = plain('n2')
    const steps = [forEachStep, s1, v2If, n1, n2]

    expect(isStepInsideForEachBody(s1, steps, GROUPING_ACTIONS)).toBe(true)
    // A nested if-then's header and its members are inside the for-each body.
    expect(isStepInsideForEachBody(v2If, steps, GROUPING_ACTIONS)).toBe(true)
    expect(isStepInsideForEachBody(n1, steps, GROUPING_ACTIONS)).toBe(true)
  })

  it('is false for the for-each step itself', () => {
    const forEachStep = forEach('forEach')
    const s1 = plain('s1')
    const steps = [forEachStep, s1]

    expect(isStepInsideForEachBody(forEachStep, steps, GROUPING_ACTIONS)).toBe(
      false,
    )
  })

  it('is false when the flow has no for-each', () => {
    const block = markedIfThen('block', 'b1')
    const b1 = plain('b1')
    const steps = [block, b1]

    expect(isStepInsideForEachBody(b1, steps, GROUPING_ACTIONS)).toBe(false)
  })
})

describe('hasIfThenV2Block', () => {
  it('is true for a populated if-then V2 block', () => {
    const block = markedIfThen('block', 's2')
    const s2 = plain('s2')

    expect(hasIfThenV2Block([block, s2])).toBe(true)
  })

  it('is true for an empty (self-referencing) if-then V2 block', () => {
    const block = markedIfThen('block', 'block')

    expect(hasIfThenV2Block([block])).toBe(true)
  })

  it('is false for a marker-less if-then shaped like real GraphQL data', () => {
    const ifThenA = nullMarkerIfThen('ifThenA')

    expect(hasIfThenV2Block([ifThenA])).toBe(false)
  })

  it('is false for a flow with no if-then step at all', () => {
    const s1 = plain('s1')
    const s2 = plain('s2')

    expect(hasIfThenV2Block([s1, s2])).toBe(false)
  })

  it('is true when only one of several if-thens carries a marker', () => {
    const ifThenA = nullMarkerIfThen('ifThenA')
    const block = markedIfThen('block', 'b1')
    const b1 = plain('b1')

    expect(hasIfThenV2Block([ifThenA, block, b1])).toBe(true)
  })
})

describe('isBlankPlaceholderStep', () => {
  it('is true for a step with neither appKey nor key', () => {
    expect(isBlankPlaceholderStep(blank('child'))).toBe(true)
  })

  it('is false for a fully-configured step', () => {
    expect(isBlankPlaceholderStep(plain('s1'))).toBe(false)
  })

  it('is false for an if-then step', () => {
    expect(isBlankPlaceholderStep(ifThen('block'))).toBe(false)
  })
})
