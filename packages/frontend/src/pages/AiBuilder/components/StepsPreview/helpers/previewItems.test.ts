import { describe, expect, it } from 'vitest'

import {
  buildPreviewItems,
  flattenPreviewItem,
  isTestedPreviewBlock,
  type PreviewItem,
  type PreviewStep,
} from './previewItems'

function step(
  id: string,
  appKey: string,
  key: string,
  extra: Partial<PreviewStep> = {},
): PreviewStep {
  return {
    id,
    appKey,
    key,
    type: 'action',
    position: 0,
    parameters: {},
    ...extra,
  } as PreviewStep
}

const ifThen = (id: string, extra: Partial<PreviewStep> = {}) =>
  step(id, 'toolbox', 'ifThen', extra)
const forEach = (id: string) => step(id, 'toolbox', 'forEach')
const email = (id: string) => step(id, 'postman', 'sendTransactionalEmail')

describe('buildPreviewItems', () => {
  it('bounds an If block by its pipe-state endStepId', () => {
    const items = buildPreviewItems([
      ifThen('if', { endStepId: 'b' }),
      email('a'),
      email('b'),
      email('c'),
    ])

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      type: 'ifThenBlock',
      ifThenStep: { id: 'if' },
      children: [{ id: 'a' }, { id: 'b' }],
    })
    expect(items[1]).toMatchObject({ type: 'step', step: { id: 'c' } })
  })

  it('bounds an If block by its proposal ifThenChildCount', () => {
    const items = buildPreviewItems([
      ifThen('if', { ifThenChildCount: 1 }),
      email('a'),
      email('b'),
    ])

    expect(items).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }] },
      { type: 'step', step: { id: 'b' } },
    ])
  })

  it('reads a marker from config.endStepId too', () => {
    const items = buildPreviewItems([
      ifThen('if', { config: { endStepId: 'a' } }),
      email('a'),
      email('b'),
    ])

    expect(items).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }] },
      { type: 'step', step: { id: 'b' } },
    ])
  })

  it('renders an empty block for a self-referencing marker', () => {
    const items = buildPreviewItems([
      ifThen('if', { endStepId: 'if' }),
      email('a'),
    ])

    expect(items).toMatchObject([
      { type: 'ifThenBlock', children: [] },
      { type: 'step', step: { id: 'a' } },
    ])
  })

  it('falls back to the derived extent for a legacy if-then', () => {
    const items = buildPreviewItems([
      email('a'),
      ifThen('if1', { endStepId: null }),
      email('b'),
      email('c'),
      ifThen('if2'),
      email('d'),
    ])

    expect(items).toMatchObject([
      { type: 'step', step: { id: 'a' } },
      { type: 'ifThenBlock', children: [{ id: 'b' }, { id: 'c' }] },
      { type: 'ifThenBlock', children: [{ id: 'd' }] },
    ])
  })

  it('caps a metadata count at the remaining steps', () => {
    const items = buildPreviewItems([
      ifThen('if', { ifThenChildCount: 5 }),
      email('a'),
    ])

    expect(items).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }] },
    ])
  })

  it('puts every later step into the for-each body, blocks included', () => {
    const items = buildPreviewItems([
      email('a'),
      forEach('loop'),
      ifThen('if', { endStepId: 'b' }),
      email('b'),
      email('c'),
    ])

    expect(items).toMatchObject([
      { type: 'step', step: { id: 'a' } },
      {
        type: 'forEachBlock',
        forEachStep: { id: 'loop' },
        children: [
          { type: 'ifThenBlock', children: [{ id: 'b' }] },
          { type: 'step', step: { id: 'c' } },
        ],
      },
    ])
  })
})

describe('flattenPreviewItem', () => {
  it('lists every step in a for-each body in order', () => {
    const [, loop] = buildPreviewItems([
      email('a'),
      forEach('loop'),
      ifThen('if', { endStepId: 'b' }),
      email('b'),
      email('c'),
    ])

    expect(flattenPreviewItem(loop).map((s) => s.id)).toEqual([
      'loop',
      'if',
      'b',
      'c',
    ])
  })
})

function block(
  items: PreviewItem[],
  type: 'ifThenBlock' | 'forEachBlock',
): Extract<PreviewItem, { type: 'ifThenBlock' | 'forEachBlock' }> {
  const found = items.find((item) => item.type === type)
  if (
    !found ||
    (found.type !== 'ifThenBlock' && found.type !== 'forEachBlock')
  ) {
    throw new Error(`missing ${type}`)
  }
  return found
}

describe('isTestedPreviewBlock', () => {
  it('checks an If block once its own step has tested and it has a child', () => {
    const items = buildPreviewItems([
      ifThen('if', { endStepId: 'b' }),
      email('b'),
    ])

    expect(
      isTestedPreviewBlock(block(items, 'ifThenBlock'), new Set(['if'])),
    ).toBe(true)
    expect(
      isTestedPreviewBlock(block(items, 'ifThenBlock'), new Set(['b'])),
    ).toBe(false)
  })

  it('leaves an empty If block unchecked', () => {
    const items = buildPreviewItems([ifThen('if', { endStepId: 'if' })])

    expect(
      isTestedPreviewBlock(block(items, 'ifThenBlock'), new Set(['if'])),
    ).toBe(false)
  })

  it('leaves an If block unchecked when its only step is a blank placeholder', () => {
    const items = buildPreviewItems([
      ifThen('if', { endStepId: 'blank' }),
      step('blank', '', ''),
    ])

    expect(
      isTestedPreviewBlock(block(items, 'ifThenBlock'), new Set(['if'])),
    ).toBe(false)
  })

  it('checks a Repeat block once its own step has tested and the body has steps', () => {
    const items = buildPreviewItems([forEach('loop'), email('b')])

    expect(
      isTestedPreviewBlock(block(items, 'forEachBlock'), new Set(['loop'])),
    ).toBe(true)
    expect(
      isTestedPreviewBlock(block(items, 'forEachBlock'), new Set(['b'])),
    ).toBe(false)
  })
})
