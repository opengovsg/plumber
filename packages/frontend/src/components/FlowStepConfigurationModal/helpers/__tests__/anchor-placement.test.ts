import type { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import {
  isAnchorInsideForEachBody,
  isAnchorInsideIfThenBlock,
} from '../anchor-placement'

//
// Fixtures. The resolution runs over the MRF-filtered action-step list (the
// trigger already removed), ordered by position, so these never include a
// trigger.
//

const plain = (id: string): IStep =>
  ({ id, appKey: 'postman', key: 'sendTransactionalEmail' }) as IStep

const ifThen = (id: string, extra: Partial<IStep> = {}): IStep =>
  ({
    id,
    appKey: 'toolbox',
    key: 'ifThen',
    parameters: { depth: '0' },
    ...extra,
  }) as IStep

// The endStepId marker is what makes an if-then V2, so tests that need one
// use this instead of the plain `ifThen` fixture.
const markedIfThen = (id: string, endStepId: string): IStep =>
  ifThen(id, { config: { endStepId } })

const forEach = (id: string): IStep =>
  ({ id, appKey: 'toolbox', key: 'forEach' }) as IStep

// The set of grouping actions (`groupsLaterSteps`) is exactly if-then and
// for-each today.
const GROUPING_ACTIONS = new Set(['toolbox-ifThen', 'toolbox-forEach'])

describe('isAnchorInsideIfThenBlock', () => {
  it('believes a launcher that places the step after a block, over its anchor', () => {
    // The add-after-block button's anchor is the block's last child, which
    // is itself inside the block. Its step lands outside.
    const child = plain('child')
    const actionSteps = [markedIfThen('ifThen', 'child'), child]

    expect(
      isAnchorInsideIfThenBlock({
        anchorPlacement: 'after-if-then-block',
        anchorStep: child,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })

  it('believes a launcher that places the step inside a block, over its anchor', () => {
    // The empty-block placeholder's anchor is the if-then step itself, which
    // is not inside its own block. Its step lands inside.
    const emptyBlock = markedIfThen('ifThen', 'ifThen')
    const actionSteps = [emptyBlock, plain('after')]

    expect(
      isAnchorInsideIfThenBlock({
        anchorPlacement: 'inside-if-then-block',
        anchorStep: emptyBlock,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('reads a block child off the anchor when no placement is given', () => {
    const child = plain('child')
    const actionSteps = [markedIfThen('ifThen', 'child'), child, plain('after')]

    expect(
      isAnchorInsideIfThenBlock({
        anchorStep: child,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('reads a top-level step off the anchor as outside every block', () => {
    const after = plain('after')
    const actionSteps = [markedIfThen('ifThen', 'child'), plain('child'), after]

    expect(
      isAnchorInsideIfThenBlock({
        anchorStep: after,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })

  it('reads a for-each body step outside any block as outside every block', () => {
    const inBody = plain('inBody')
    const actionSteps = [forEach('forEach'), inBody]

    expect(
      isAnchorInsideIfThenBlock({
        anchorStep: inBody,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })

  it('reads a step in a block nested under a for-each as inside a block', () => {
    const nestedChild = plain('nestedChild')
    const actionSteps = [
      forEach('forEach'),
      plain('inBody'),
      markedIfThen('nestedIfThen', 'nestedChild'),
      nestedChild,
    ]

    expect(
      isAnchorInsideIfThenBlock({
        anchorStep: nestedChild,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('is outside every block when there is no anchor at all', () => {
    const actionSteps = [markedIfThen('ifThen', 'child'), plain('child')]

    expect(
      isAnchorInsideIfThenBlock({
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })
})

describe('isAnchorInsideForEachBody', () => {
  it('counts a for-each step as its own body, since a step after it lands there', () => {
    const forEachStep = forEach('forEach')
    const actionSteps = [plain('before'), forEachStep, plain('inBody')]

    expect(
      isAnchorInsideForEachBody({
        anchorStep: forEachStep,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('counts a step in the body', () => {
    const inBody = plain('inBody')
    const actionSteps = [forEach('forEach'), inBody]

    expect(
      isAnchorInsideForEachBody({
        anchorStep: inBody,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('counts a step inside a block nested in the body', () => {
    const nestedChild = plain('nestedChild')
    const actionSteps = [
      forEach('forEach'),
      markedIfThen('nestedIfThen', 'nestedChild'),
      nestedChild,
    ]

    expect(
      isAnchorInsideForEachBody({
        anchorStep: nestedChild,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(true)
  })

  it('does not count a step before the for-each', () => {
    const before = plain('before')
    const actionSteps = [before, forEach('forEach'), plain('inBody')]

    expect(
      isAnchorInsideForEachBody({
        anchorStep: before,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })

  it('does not count anything in a flow with no for-each', () => {
    const child = plain('child')
    const actionSteps = [markedIfThen('ifThen', 'child'), child]

    expect(
      isAnchorInsideForEachBody({
        anchorStep: child,
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })

  it('is outside every body when there is no anchor at all', () => {
    const actionSteps = [forEach('forEach'), plain('inBody')]

    expect(
      isAnchorInsideForEachBody({
        actionSteps,
        groupingActions: GROUPING_ACTIONS,
      }),
    ).toBe(false)
  })
})
