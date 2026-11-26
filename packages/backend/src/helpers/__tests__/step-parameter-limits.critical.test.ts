/**
 * Business rule: "set a cap on the number of keys in step.parameters".
 * Caps: 5,000 properties (object keys plus array elements, at any depth),
 * 10 levels of nesting and 1 MB serialized. Every writer rejects a step over
 * any cap before it is stored.
 */
import { describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'

import {
  assertStepParametersWithinLimits,
  MAX_STEP_PARAMETER_BYTES,
  MAX_STEP_PARAMETER_DEPTH,
  MAX_STEP_PARAMETER_PROPERTIES,
  STEP_PARAMETERS_TOO_LARGE_MESSAGE,
} from '../step-parameter-limits'

function flat(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`key${i}`, 'v']),
  )
}

// `levels` containers deep. The innermost container holds `leaf`.
function nestedObjects(levels: number, leaf: unknown): unknown {
  let value = leaf
  for (let i = 0; i < levels; i++) {
    value = { child: value }
  }
  return value
}

function nestedArrays(levels: number, leaf: unknown): unknown {
  let value = leaf
  for (let i = 0; i < levels; i++) {
    value = [value]
  }
  return value
}

const expectRejected = (parameters: unknown) =>
  expect(() => assertStepParametersWithinLimits(parameters)).toThrow(
    new BadUserInputError(STEP_PARAMETERS_TOO_LARGE_MESSAGE),
  )

const expectAccepted = (parameters: unknown) =>
  expect(() => assertStepParametersWithinLimits(parameters)).not.toThrow()

describe('assertStepParametersWithinLimits', () => {
  it('pins the cap values', () => {
    expect(MAX_STEP_PARAMETER_PROPERTIES).toBe(5_000)
    expect(MAX_STEP_PARAMETER_DEPTH).toBe(10)
    expect(MAX_STEP_PARAMETER_BYTES).toBe(1024 * 1024)
  })

  it('accepts empty, null and undefined parameters', () => {
    expectAccepted({})
    expectAccepted(null)
    expectAccepted(undefined)
  })

  it('accepts exactly 5,000 properties and rejects 5,001', () => {
    expectAccepted(flat(5_000))
    expectRejected(flat(5_001))
  })

  it('counts array elements and nested keys as properties', () => {
    // 1 key + 2,500 elements + 2,500 nested keys
    expectRejected({ rows: Array.from({ length: 2_500 }, () => ({ a: 'v' })) })
  })

  it.each([
    ['objects', nestedObjects],
    ['arrays', nestedArrays],
  ])('allows values 10 levels deep in %s, not 11', (_, nest) => {
    // The root is level 0, so 10 containers put the leaf at level 10.
    expectAccepted(nest(10, 'v'))
    expectRejected(nest(11, 'v'))
  })

  it.each([
    ['object', {}],
    ['array', []],
  ])('counts an empty %s as a value at its level', (_, empty) => {
    expectAccepted(nestedObjects(9, empty))
    expectAccepted(nestedObjects(10, empty))
    expectRejected(nestedObjects(11, empty))
  })

  it('measures size in UTF-8 bytes, not characters', () => {
    // '{"body":""}' is 11 bytes. Each '€' is 3 bytes.
    const atLimit =
      'a'.repeat((MAX_STEP_PARAMETER_BYTES - 11) % 3) +
      '€'.repeat(Math.floor((MAX_STEP_PARAMETER_BYTES - 11) / 3))
    expectAccepted({ body: atLimit })
    expectRejected({ body: atLimit + 'a' })
  })

  it('accepts the largest shapes seen in prod', () => {
    expectAccepted({
      ...flat(890),
      body: 'x'.repeat(600_000),
      conditions: nestedObjects(5, 'v'),
    })
  })

  it('rejects deep nesting without overflowing the stack', () => {
    expectRejected(nestedObjects(100_000, 'v'))
  })

  it('stops counting once a wide object passes the cap', () => {
    const wide = flat(100_000)
    let reads = 0
    const counted = new Proxy(wide, {
      get(target, key, receiver) {
        reads += 1
        return Reflect.get(target, key, receiver)
      },
    })
    expectRejected(counted)
    expect(reads).toBe(MAX_STEP_PARAMETER_PROPERTIES + 1)
  })
})
