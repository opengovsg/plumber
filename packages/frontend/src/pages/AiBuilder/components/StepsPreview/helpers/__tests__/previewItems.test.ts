import { describe, expect, it } from 'vitest'

import {
  buildPreviewItems,
  isTestedPreviewBlock,
  type PreviewItem,
  type PreviewStep,
} from '../previewItems'

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

function block(
  items: PreviewItem[],
  type: 'ifThenBlock' | 'forEachBlock',
): Extract<PreviewItem, { type: 'ifThenBlock' | 'forEachBlock' }> {
  const found = items.find((item) => item.type === type)
  if (found?.type !== type) {
    throw new Error(`missing ${type}`)
  }
  return found
}

describe('buildPreviewItems', () => {
  it('ends an If block at its marker and leaves the next step outside', () => {
    expect(
      buildPreviewItems([
        ifThen('if', { endStepId: 'b' }),
        email('a'),
        email('b'),
        email('c'),
      ]),
    ).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }, { id: 'b' }] },
      { type: 'step', step: { id: 'c' } },
    ])
  })

  it('ends a proposal If block at its child count', () => {
    expect(
      buildPreviewItems([
        ifThen('if', { ifThenChildCount: 1 }),
        email('a'),
        email('b'),
      ]),
    ).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }] },
      { type: 'step', step: { id: 'b' } },
    ])
  })

  it('groups a legacy If through to the next If', () => {
    expect(
      buildPreviewItems([ifThen('if1'), email('a'), ifThen('if2'), email('b')]),
    ).toMatchObject([
      { type: 'ifThenBlock', children: [{ id: 'a' }] },
      { type: 'ifThenBlock', children: [{ id: 'b' }] },
    ])
  })

  it('puts later steps, including an If block, inside Repeat', () => {
    expect(
      buildPreviewItems([
        forEach('loop'),
        ifThen('if', { endStepId: 'a' }),
        email('a'),
        email('b'),
      ]),
    ).toMatchObject([
      {
        type: 'forEachBlock',
        children: [
          { type: 'ifThenBlock', children: [{ id: 'a' }] },
          { type: 'step', step: { id: 'b' } },
        ],
      },
    ])
  })
})

describe('isTestedPreviewBlock', () => {
  it('checks the block step only when the block has a step that can run', () => {
    const filled = buildPreviewItems([
      ifThen('if', { endStepId: 'a' }),
      email('a'),
    ])
    const empty = buildPreviewItems([ifThen('if', { endStepId: 'if' })])

    expect(
      isTestedPreviewBlock(block(filled, 'ifThenBlock'), new Set(['if'])),
    ).toBe(true)
    expect(
      isTestedPreviewBlock(block(filled, 'ifThenBlock'), new Set(['a'])),
    ).toBe(false)
    expect(
      isTestedPreviewBlock(block(empty, 'ifThenBlock'), new Set(['if'])),
    ).toBe(false)
  })
})
