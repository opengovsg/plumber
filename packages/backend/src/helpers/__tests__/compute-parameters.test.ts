import { describe, expect, it } from 'vitest'

import ExecutionStep from '@/models/execution-step'

import computeParameters from '../compute-parameters'

const executionSteps = [
  {
    stepId: 'some-step-id',
    dataOut: {
      stringProp: 'string value',
      numberProp: 123,
    },
  } as unknown as ExecutionStep,
]

describe('compute parameters', () => {
  it('performs variable substitution on strings and string array elements', () => {
    const result = computeParameters(
      {
        paramWithStringVar: 'herp! {{step.some-step-id.stringProp}}',
        paramWithNumberVar: 'derp! {{step.some-step-id.numberProp}}',
        arrayParam: [
          '{{step.some-step-id.stringProp}}',
          '{{step.some-step-id.numberProp}}',
        ],
      },
      executionSteps,
    )
    expect(result).toEqual({
      paramWithStringVar: 'herp! string value',
      paramWithNumberVar: 'derp! 123',
      arrayParam: [
        'string value',
        // this is expected to be string; we preserve the original type
        '123',
      ],
    })
  })

  it('is a no-op on strings or string arrays without variables', () => {
    const result = computeParameters(
      {
        param: 'herp!',
        arrayParam: ['derp', 'meh'],
      },
      executionSteps,
    )
    expect(result).toEqual({
      param: 'herp!',
      arrayParam: ['derp', 'meh'],
    })
  })

  it('is a no-op on non-strings', () => {
    const result = computeParameters(
      {
        numberParam: 123,
        numArrayParam: [1, 2, 3],
        objectParam: { a: '1', b: '2' },
        objArrayParam: [
          { a: '1', b: '2' },
          { c: '3', d: '4' },
        ],
        objectWithNestedVariable: {
          tricky: '{{step.some-step-id.stringProp}}',
        },
        mixedArrayParam: ['abcd', 1234, { e: '5', f: '6' }],
      },
      executionSteps,
    )

    expect(result).toEqual({
      numberParam: 123,
      numArrayParam: [1, 2, 3],
      objectParam: { a: '1', b: '2' },
      objArrayParam: [
        { a: '1', b: '2' },
        { c: '3', d: '4' },
      ],
      objectWithNestedVariable: {
        tricky: '{{step.some-step-id.stringProp}}',
      },
      mixedArrayParam: ['abcd', 1234, { e: '5', f: '6' }],
    })
  })

  it('supports case where only some params have variables', () => {
    const result = computeParameters(
      {
        stringParam: 'hi thar',
        numArrayParam: [1, 2, 3],
        objectParam: { a: '1', b: '2' },
        mixedArrayParam: [
          'herp! {{step.some-step-id.stringProp}}',
          9000,
          {
            tricky: '{{step.some-step-id.stringProp}}',
          },
          '{{step.some-step-id.numberProp}}',
        ],
      },
      executionSteps,
    )
    expect(result).toEqual({
      stringParam: 'hi thar',
      numArrayParam: [1, 2, 3],
      objectParam: { a: '1', b: '2' },
      mixedArrayParam: [
        'herp! string value',
        9000,
        {
          tricky: '{{step.some-step-id.stringProp}}',
        },
        '123',
      ],
    })
  })
})
