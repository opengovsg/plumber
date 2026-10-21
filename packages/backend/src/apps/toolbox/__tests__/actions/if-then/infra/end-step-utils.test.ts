import type { IStepConfig } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import {
  deriveIfThenV1EndStep,
  expandIfThenBlockDeletions,
  findBlankPlaceholderMemberIds,
  reassignIfThenEndStepsOnDelete,
  reassignIfThenEndStepsOnReorder,
  remapIfThenEndStepIdsOnDuplicate,
  remapIfThenEndStepIdsOnDuplicateBranch,
} from '../../../../actions/if-then/infra/end-step-utils'

type Fixture = {
  id: string
  appKey?: string
  key?: string
  parameters?: Record<string, any>
  position: number
  config?: IStepConfig
}

const trigger = (position: number): Fixture => ({
  id: `trigger${position}`,
  appKey: 'formsg',
  key: 'newSubmission',
  position,
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

const REJECT_MANAGER = {
  approval: { branch: 'reject', stepId: 'mrfManager' },
} satisfies IStepConfig

const REJECT_DIRECTOR = {
  approval: { branch: 'reject', stepId: 'mrfDirector' },
} satisfies IStepConfig

const ifThen = (
  id: string,
  position: number,
  extra: Partial<Fixture> = {},
): Fixture => ({
  id,
  appKey: 'toolbox',
  key: 'ifThen',
  parameters: { depth: '0' },
  position,
  ...extra,
})

const mrfSubmission = (id: string, position: number): Fixture => ({
  id,
  appKey: 'formsg',
  key: 'mrfSubmission',
  position,
})

// A leftover blank child from the V1 branch initializer.
const blank = (id: string, position: number): Fixture => ({
  id,
  position,
})

describe('deriveIfThenV1EndStep', () => {
  it('derives the extent of a 2-branch block up to the step before the next if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const stepA = plain('stepA', 3)
    const ifThenB = ifThen('ifThenB', 4)
    const stepB = plain('stepB', 5)
    const steps = [trigger(1), ifThenA, stepA, ifThenB, stepB]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
  })

  it('derives extents for each branch of a 3-branch block', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const ifThenB = ifThen('ifThenB', 4)
    const ifThenC = ifThen('ifThenC', 6)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      ifThenB,
      plain('stepB', 5),
      ifThenC,
      plain('stepC', 7),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
    expect(deriveIfThenV1EndStep(steps, ifThenC).id).toBe('stepC')
  })

  it('extends to the end of the flow when there is no following if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      plain('stepB', 4),
      plain('stepC', 5),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepC')
  })

  it('returns the if-then itself (self-ref) for an empty block abutting the next if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const ifThenB = ifThen('ifThenB', 3)
    const steps = [trigger(1), ifThenA, ifThenB, plain('stepB', 4)]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('ifThenA')
  })

  it('clamps a main-flow block to the step before an mrfSubmission', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const rejectIfThen = ifThen('rejectIfThen', 5, {
      parameters: { depth: '0' },
    })
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      mrfSubmission('mrf', 4),
      rejectIfThen,
      plain('stepAfter', 6),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
  })

  it('clamps a rejection-branch block to the step before the next mrfSubmission', () => {
    const ifThenA = ifThen('ifThenA', 3, { config: REJECT_MANAGER })
    const steps = [
      trigger(1),
      mrfSubmission('mrfManager', 2),
      ifThenA,
      plain('rejectChild', 4, REJECT_MANAGER),
      mrfSubmission('mrfDirector', 5),
      plain('mainAfter', 6),
      ifThen('ifThenB', 7),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('rejectChild')
  })

  it('clamps a main-flow block to the step before a rejection branch starts', () => {
    const ifThenA = ifThen('ifThenA', 3)
    const steps = [
      trigger(1),
      mrfSubmission('mrfDirector', 2),
      ifThenA,
      plain('mainChild', 4),
      plain('rejectChild', 5, REJECT_DIRECTOR),
      ifThen('rejectIfThen', 6, { config: REJECT_DIRECTOR }),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('mainChild')
  })

  it('clamps at a step belonging to a different rejection branch', () => {
    const ifThenA = ifThen('ifThenA', 3, { config: REJECT_MANAGER })
    const steps = [
      trigger(1),
      mrfSubmission('mrfManager', 2),
      ifThenA,
      plain('managerChild', 4, REJECT_MANAGER),
      plain('directorChild', 5, REJECT_DIRECTOR),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('managerChild')
  })

  it('clamps the no-following-if-then case instead of running to the flow end', () => {
    const ifThenA = ifThen('ifThenA', 3, { config: REJECT_MANAGER })
    const steps = [
      trigger(1),
      mrfSubmission('mrfManager', 2),
      ifThenA,
      plain('rejectChild', 4, REJECT_MANAGER),
      mrfSubmission('mrfDirector', 5),
      plain('mainAfter', 6),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('rejectChild')
  })

  it('returns the if-then itself when its region ends immediately after it', () => {
    const ifThenA = ifThen('ifThenA', 3, { config: REJECT_MANAGER })
    const steps = [
      trigger(1),
      mrfSubmission('mrfManager', 2),
      ifThenA,
      mrfSubmission('mrfDirector', 4),
      plain('mainAfter', 5),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('ifThenA')
  })

  it('does not treat a deeper (nested) if-then as a boundary (mirrors V1 depth scan)', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const nested = ifThen('nested', 4, { parameters: { depth: '1' } })
    const ifThenB = ifThen('ifThenB', 6)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      nested,
      plain('stepB', 5),
      ifThenB,
      plain('stepC', 7),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepB')
  })
})

describe('findBlankPlaceholderMemberIds', () => {
  it('finds a lone blank child that is the whole block', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const child = blank('child', 3)
    const steps = [trigger(1), ifThenA, child]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, child)).toEqual([
      'child',
    ])
  })

  it('finds a blank member alongside real ones, ignoring the real ones', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const real = plain('real', 3)
    const child = blank('child', 4)
    const steps = [trigger(1), ifThenA, real, child]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, child)).toEqual([
      'child',
    ])
  })

  it('returns every blank member when there are more than one', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const firstBlank = blank('firstBlank', 3)
    const real = plain('real', 4)
    const secondBlank = blank('secondBlank', 5)
    const steps = [trigger(1), ifThenA, firstBlank, real, secondBlank]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, secondBlank)).toEqual([
      'firstBlank',
      'secondBlank',
    ])
  })

  it('returns an empty array for a fully-configured block', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const real = plain('real', 3)
    const steps = [trigger(1), ifThenA, real]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, real)).toEqual([])
  })

  it('returns an empty array for an empty (self-referencing) block', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const steps = [trigger(1), ifThenA]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, ifThenA)).toEqual([])
  })

  it('ignores a blank step outside the block range', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const real = plain('real', 3)
    const outsideBlank = blank('outsideBlank', 4)
    const steps = [trigger(1), ifThenA, real, outsideBlank]

    expect(findBlankPlaceholderMemberIds(steps, ifThenA, real)).toEqual([])
  })
})

const markedIfThen = (
  id: string,
  position: number,
  endStepId: string,
): Fixture => ifThen(id, position, { config: { endStepId } })

describe('reassignIfThenEndStepsOnDelete', () => {
  it('repoints a block whose endStep (tail) was deleted to the new highest survivor', () => {
    const block = markedIfThen('A', 2, 's4')
    const steps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s4'])).toEqual([
      { ifThenStepId: 'A', endStepId: 's3' },
    ])
  })

  it('repoints to the highest surviving member when the tail run is deleted', () => {
    const block = markedIfThen('A', 2, 's5')
    const steps = [
      trigger(1),
      block,
      plain('s3', 3),
      plain('s4', 4),
      plain('s5', 5),
    ]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s4', 's5'])).toEqual([
      { ifThenStepId: 'A', endStepId: 's3' },
    ])
  })

  it('empties a block to self-reference when every member is deleted', () => {
    const block = markedIfThen('A', 2, 's4')
    const steps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s3', 's4'])).toEqual([
      { ifThenStepId: 'A', endStepId: 'A' },
    ])
  })

  it('leaves a block untouched when a mid-block member is deleted but the endStep survives', () => {
    const block = markedIfThen('A', 2, 's5')
    const steps = [
      trigger(1),
      block,
      plain('s3', 3),
      plain('s4', 4),
      plain('s5', 5),
    ]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s4'])).toEqual([])
  })

  it('does not repair a block whose own if-then is deleted', () => {
    const block = markedIfThen('A', 2, 's3')
    const steps = [trigger(1), block, plain('s3', 3)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['A', 's3'])).toEqual([])
  })

  it('leaves a surviving empty (self-referencing) block untouched', () => {
    const block = markedIfThen('A', 2, 'A')
    const steps = [trigger(1), block, plain('s3', 3)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s3'])).toEqual([])
  })

  it('repairs multiple blocks in a single batch', () => {
    const blockA = markedIfThen('A', 2, 'a3')
    const blockB = markedIfThen('B', 4, 'b5')
    const steps = [trigger(1), blockA, plain('a3', 3), blockB, plain('b5', 5)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['a3', 'b5'])).toEqual([
      { ifThenStepId: 'A', endStepId: 'A' },
      { ifThenStepId: 'B', endStepId: 'B' },
    ])
  })

  it('never repairs a legacy (marker-less) if-then', () => {
    const legacy = ifThen('L', 2)
    const steps = [trigger(1), legacy, plain('s3', 3)]

    expect(reassignIfThenEndStepsOnDelete(steps, ['s3'])).toEqual([])
  })
})

describe('expandIfThenBlockDeletions', () => {
  const ids = (set: Set<string>) => [...set].sort()

  it('expands a single marked if-then id to its whole block range', () => {
    const block = markedIfThen('A', 2, 's4')
    const steps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      steps,
      ['A'],
    )
    expect(ids(expandedIds)).toEqual(['A', 's3', 's4'])
    expect(danglingIfThenIds).toEqual([])
  })

  it('is a no-op when the full range is already requested', () => {
    const block = markedIfThen('A', 2, 's4')
    const steps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    const { expandedIds } = expandIfThenBlockDeletions(steps, ['A', 's3', 's4'])
    expect(ids(expandedIds)).toEqual(['A', 's3', 's4'])
  })

  it('never expands a legacy (marker-less) if-then', () => {
    const legacy = ifThen('L', 2)
    const steps = [trigger(1), legacy, plain('s3', 3), plain('s4', 4)]

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      steps,
      ['L'],
    )
    expect(ids(expandedIds)).toEqual(['L'])
    expect(danglingIfThenIds).toEqual([])
  })

  it('expands an empty (self-referencing) block to just its if-then', () => {
    const block = markedIfThen('A', 2, 'A')
    const steps = [trigger(1), block, plain('s3', 3)]

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      steps,
      ['A'],
    )
    expect(ids(expandedIds)).toEqual(['A'])
    expect(danglingIfThenIds).toEqual([])
  })

  it('does not expand a block with a dangling marker and reports it', () => {
    const block = markedIfThen('A', 2, 'ghost')
    const steps = [trigger(1), block, plain('s3', 3)]

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      steps,
      ['A'],
    )
    expect(ids(expandedIds)).toEqual(['A'])
    expect(danglingIfThenIds).toEqual(['A'])
  })

  it('treats a marker pointing before the if-then as dangling', () => {
    const block = markedIfThen('A', 4, 's2')
    const steps = [trigger(1), plain('s2', 2), plain('s3', 3), block]

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      steps,
      ['A'],
    )
    expect(ids(expandedIds)).toEqual(['A'])
    expect(danglingIfThenIds).toEqual(['A'])
  })

  it('passes plain-step deletions through unchanged', () => {
    const block = markedIfThen('A', 2, 's4')
    const steps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]

    // Deleting an interior member (not the if-then) does not expand.
    const { expandedIds } = expandIfThenBlockDeletions(steps, ['s3'])
    expect(ids(expandedIds)).toEqual(['s3'])
  })
})

describe('reassignIfThenEndStepsOnReorder', () => {
  it('moves the endStep to the member that now sits at the highest position', () => {
    const block = markedIfThen('A', 2, 's5')
    const preSteps = [
      trigger(1),
      block,
      plain('s3', 3),
      plain('s4', 4),
      plain('s5', 5),
    ]
    const newPositions = [
      { id: 's5', position: 3 },
      { id: 's3', position: 4 },
      { id: 's4', position: 5 },
    ]

    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([
      { ifThenStepId: 'A', endStepId: 's4' },
    ])
  })

  it('is a no-op when the reorder does not touch a block', () => {
    const block = markedIfThen('A', 2, 's3')
    const preSteps = [
      trigger(1),
      block,
      plain('s3', 3),
      plain('a4', 4),
      plain('a5', 5),
    ]
    const newPositions = [
      { id: 'a5', position: 4 },
      { id: 'a4', position: 5 },
    ]

    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([])
  })

  it('preserves membership when a whole block moves as a unit', () => {
    const before = plain('before', 2)
    const block = markedIfThen('A', 3, 's5')
    const preSteps = [trigger(1), before, block, plain('s4', 4), plain('s5', 5)]
    const newPositions = [
      { id: 'A', position: 2 },
      { id: 's4', position: 3 },
      { id: 's5', position: 4 },
      { id: 'before', position: 5 },
    ]

    // s5 is still the highest-positioned member, so nothing changes.
    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([])
  })

  it('leaves an empty (self-referencing) block untouched', () => {
    const block = markedIfThen('A', 2, 'A')
    const preSteps = [trigger(1), block, plain('a3', 3), plain('a4', 4)]
    const newPositions = [
      { id: 'a3', position: 4 },
      { id: 'a4', position: 3 },
    ]

    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([])
  })

  it('leaves a block with a dangling marker untouched', () => {
    const block = markedIfThen('A', 2, 'ghost')
    const preSteps = [trigger(1), block, plain('s3', 3), plain('s4', 4)]
    const newPositions = [
      { id: 's3', position: 4 },
      { id: 's4', position: 3 },
    ]

    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([])
  })

  it('repairs only the block whose interior was reordered', () => {
    const blockA = markedIfThen('A', 2, 'a4')
    const blockB = markedIfThen('B', 5, 'b7')
    const preSteps = [
      trigger(1),
      blockA,
      plain('a3', 3),
      plain('a4', 4),
      blockB,
      plain('b6', 6),
      plain('b7', 7),
    ]
    const newPositions = [
      { id: 'b7', position: 6 },
      { id: 'b6', position: 7 },
    ]

    expect(reassignIfThenEndStepsOnReorder(preSteps, newPositions)).toEqual([
      { ifThenStepId: 'B', endStepId: 'b6' },
    ])
  })
})

describe('remapIfThenEndStepIdsOnDuplicate', () => {
  it('remaps a marker to the copied endStep id', () => {
    const sourceSteps = [trigger(1), markedIfThen('A', 2, 's3'), plain('s3', 3)]
    const map = { trigger1: 'newTrigger', A: 'newA', s3: 'newS3' }

    expect(remapIfThenEndStepIdsOnDuplicate(sourceSteps, map)).toEqual({
      patches: [{ ifThenStepId: 'newA', endStepId: 'newS3' }],
      danglingSourceStepIds: [],
    })
  })

  it('remaps a self-referencing (empty) block to the new self id', () => {
    const sourceSteps = [trigger(1), markedIfThen('A', 2, 'A')]
    const map = { trigger1: 'newTrigger', A: 'newA' }

    expect(remapIfThenEndStepIdsOnDuplicate(sourceSteps, map)).toEqual({
      patches: [{ ifThenStepId: 'newA', endStepId: 'newA' }],
      danglingSourceStepIds: [],
    })
  })

  it('reports a source marker that does not resolve to a copied step', () => {
    const sourceSteps = [trigger(1), markedIfThen('A', 2, 'ghost')]
    const map = { trigger1: 'newTrigger', A: 'newA' }

    expect(remapIfThenEndStepIdsOnDuplicate(sourceSteps, map)).toEqual({
      patches: [],
      danglingSourceStepIds: ['A'],
    })
  })

  it('ignores legacy (marker-less) if-thens', () => {
    const sourceSteps = [trigger(1), ifThen('L', 2), plain('s3', 3)]
    const map = { trigger1: 'newTrigger', L: 'newL', s3: 'newS3' }

    expect(remapIfThenEndStepIdsOnDuplicate(sourceSteps, map)).toEqual({
      patches: [],
      danglingSourceStepIds: [],
    })
  })

  it('remaps multiple blocks', () => {
    const sourceSteps = [
      trigger(1),
      markedIfThen('A', 2, 'a3'),
      plain('a3', 3),
      markedIfThen('B', 4, 'b5'),
      plain('b5', 5),
    ]
    const map = {
      trigger1: 'nt',
      A: 'nA',
      a3: 'na3',
      B: 'nB',
      b5: 'nb5',
    }

    expect(remapIfThenEndStepIdsOnDuplicate(sourceSteps, map)).toEqual({
      patches: [
        { ifThenStepId: 'nA', endStepId: 'na3' },
        { ifThenStepId: 'nB', endStepId: 'nb5' },
      ],
      danglingSourceStepIds: [],
    })
  })
})

describe('remapIfThenEndStepIdsOnDuplicateBranch', () => {
  it('remaps an intra-selection marker to the ordinal counterpart copy', () => {
    const sourceSelection = [markedIfThen('A', 2, 's2'), plain('s2', 3)]
    const newStepIds = ['nA', 'ns2']

    expect(
      remapIfThenEndStepIdsOnDuplicateBranch(sourceSelection, newStepIds),
    ).toEqual({
      patches: [{ ifThenStepId: 'nA', endStepId: 'ns2' }],
      strippedSourceStepIds: [],
    })
  })

  it('remaps a self-referencing (empty) block to its own copy', () => {
    const sourceSelection = [markedIfThen('A', 2, 'A')]
    const newStepIds = ['nA']

    expect(
      remapIfThenEndStepIdsOnDuplicateBranch(sourceSelection, newStepIds),
    ).toEqual({
      patches: [{ ifThenStepId: 'nA', endStepId: 'nA' }],
      strippedSourceStepIds: [],
    })
  })

  it('leaves the copy marker-less and reports when the marker points outside the selection', () => {
    const sourceSelection = [markedIfThen('A', 2, 'outsider'), plain('s3', 3)]
    const newStepIds = ['nA', 'ns3']

    expect(
      remapIfThenEndStepIdsOnDuplicateBranch(sourceSelection, newStepIds),
    ).toEqual({
      patches: [],
      strippedSourceStepIds: ['A'],
    })
  })

  it('ignores legacy (marker-less) if-thens in the selection', () => {
    const sourceSelection = [ifThen('L', 2), plain('s3', 3)]
    const newStepIds = ['nL', 'ns3']

    expect(
      remapIfThenEndStepIdsOnDuplicateBranch(sourceSelection, newStepIds),
    ).toEqual({
      patches: [],
      strippedSourceStepIds: [],
    })
  })

  it('remaps multiple intra-selection blocks by ordinal position', () => {
    const sourceSelection = [
      markedIfThen('A', 2, 'a2'),
      plain('a2', 3),
      markedIfThen('B', 4, 'b2'),
      plain('b2', 5),
    ]
    const newStepIds = ['nA', 'na2', 'nB', 'nb2']

    expect(
      remapIfThenEndStepIdsOnDuplicateBranch(sourceSelection, newStepIds),
    ).toEqual({
      patches: [
        { ifThenStepId: 'nA', endStepId: 'na2' },
        { ifThenStepId: 'nB', endStepId: 'nb2' },
      ],
      strippedSourceStepIds: [],
    })
  })
})
