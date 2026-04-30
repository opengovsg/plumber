import type { IJSONObject } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import { createStepParameterTransformer } from '../transform-step-parameters'

const transformerA = vi.fn((p: IJSONObject) => ({ ...p, a: true }))
const transformerB = vi.fn((p: IJSONObject) => ({ ...p, b: true }))
const transformerC = vi.fn((p: IJSONObject) => ({ ...p, c: true }))

const transform = createStepParameterTransformer({
  myAction: [transformerA, transformerB, transformerC],
})

describe('createStepParameterTransformer', () => {
  it('version 1: runs no transformers', () => {
    const input = { x: 1 }
    expect(transform('myAction', input, 1)).toEqual({ x: 1 })
    expect(transformerA).not.toHaveBeenCalled()
  })

  it('version 2: runs all transformers (A → B → C)', () => {
    const result = transform('myAction', { x: 1 }, 2)
    expect(result).toEqual({ x: 1, a: true, b: true, c: true })
  })

  it('version 3: skips first transformer, runs B → C', () => {
    const result = transform('myAction', { x: 1 }, 3)
    expect(result).toEqual({ x: 1, b: true, c: true })
    expect(result).not.toHaveProperty('a')
  })

  it('version 4: skips first two transformers, runs C only', () => {
    const result = transform('myAction', { x: 1 }, 4)
    expect(result).toEqual({ x: 1, c: true })
    expect(result).not.toHaveProperty('a')
    expect(result).not.toHaveProperty('b')
  })

  it('returns parameters unchanged for unknown action keys', () => {
    const input = { x: 1 }
    expect(transform('unknownAction', input, 2)).toEqual(input)
  })
})
