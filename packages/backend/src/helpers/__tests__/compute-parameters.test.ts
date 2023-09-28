import { describe, expect, it } from 'vitest'

import vaultWorkspace from '@/apps/vault-workspace'
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
  it.each([
    {
      testDescription: 'strings',
      params: {
        paramWithStringVar: 'herp! {{step.some-step-id.stringProp}}',
        paramWithNumberVar: 'derp! {{step.some-step-id.numberProp}}',
      },
      expected: {
        paramWithStringVar: 'herp! string value',
        paramWithNumberVar: 'derp! 123',
      },
    },
    {
      testDescription: 'string arrays',
      params: {
        arrayParam: [
          '{{step.some-step-id.stringProp}}',
          '{{step.some-step-id.numberProp}}',
        ],
      },
      expected: {
        arrayParam: [
          'string value',
          // this is expected to be string; we preserve the original type
          '123',
        ],
      },
    },
    {
      testDescription: 'non-nested objects',
      params: {
        objectParam: {
          key1: 'prefix {{step.some-step-id.stringProp}}',
          key2: '{{step.some-step-id.numberProp}}',
        },
      },
      expected: {
        objectParam: {
          key1: 'prefix string value',
          key2: '123',
        },
      },
    },
    {
      testDescription: 'arrays of non-nested objects',
      params: {
        arrayParam: [
          {
            key1: 'object 1 - {{step.some-step-id.stringProp}}',
          },
          {
            key1: 'object 2 - {{step.some-step-id.stringProp}}',
          },
        ],
      },
      expected: {
        arrayParam: [
          { key1: 'object 1 - string value' },
          { key1: 'object 2 - string value' },
        ],
      },
    },
    {
      testDescription: 'nested objects',
      params: {
        objectParam: {
          subObject: {
            key1: '{{step.some-step-id.numberProp}}',
          },
        },
      },
      expected: {
        objectParam: {
          subObject: {
            key1: '123',
          },
        },
      },
    },
    {
      testDescription: 'objects with arrays',
      params: {
        objectParam: {
          key1: [
            '{{step.some-step-id.numberProp}}',
            '{{step.some-step-id.stringProp}}',
          ],
        },
      },
      expected: {
        objectParam: {
          key1: ['123', 'string value'],
        },
      },
    },
  ])(
    'performs variable substitution on $testDescription',
    ({ params, expected }) => {
      const result = computeParameters(params, executionSteps)
      expect(result).toEqual(expected)
    },
  )

  it.each([
    {
      testDescription: 'strings',
      params: {
        param: 'herp!',
      },
    },
    {
      testDescription: 'string arrays',
      params: {
        arrayParam: ['derp', 'meh'],
      },
    },
    {
      testDescription: 'non-nested objects',
      params: {
        objectParam: {
          key1: 'derp',
          key2: 'meh',
        },
      },
    },
    {
      testDescription: 'arrays of non-nested objects',
      params: {
        arrayParam: [
          {
            key1: 'object 1',
          },
          {
            key1: 'object 2',
          },
        ],
      },
    },
    {
      testDescription: 'nested objects',
      params: {
        objectParam: {
          subObject: {
            key1: 'herp derp',
          },
        },
      },
    },
    {
      testDescription: 'objects with arrays',
      params: {
        objectParam: {
          key1: ['zzzz', 'topkek'],
        },
      },
    },
  ])('is a no-op on $testDescription without variables', ({ params }) => {
    const result = computeParameters(params, executionSteps)
    expect(result).toEqual(params)
  })

  it('correctly processes parameters that have a mix of prop types', () => {
    const result = computeParameters(
      {
        stringParam: 'hi thar',
        numArrayParam: [1, 2, 3],
        objectParam: {
          a: '1',
          b: '2',
          nestedMixedArray: [
            { deepNest: '{{step.some-step-id.stringProp}} suffix' },
            8000,
            '{{step.some-step-id.stringProp}}',
          ],
        },
        mixedArrayParam: [
          'herp! {{step.some-step-id.stringProp}}',
          9000,
          {
            key1: '{{step.some-step-id.stringProp}} suffix',
            nestedArray: ['zzz', '', '{{step.some-step-id.stringProp}}', 8888],
            anotherObject: {
              xyz: '{{step.some-step-id.numberProp}}',
              abc: 'kek',
            },
          },
          '{{step.some-step-id.numberProp}}',
        ],
      },
      executionSteps,
    )
    expect(result).toEqual({
      stringParam: 'hi thar',
      numArrayParam: [1, 2, 3],
      objectParam: {
        a: '1',
        b: '2',
        nestedMixedArray: [
          { deepNest: 'string value suffix' },
          8000,
          'string value',
        ],
      },
      mixedArrayParam: [
        'herp! string value',
        9000,
        {
          key1: 'string value suffix',
          nestedArray: ['zzz', '', 'string value', 8888],
          anotherObject: {
            xyz: '123',
            abc: 'kek',
          },
        },
        '123',
      ],
    })
  })
  it('can compute on  templates with non-hex-encoded param keys using new vault WS objects whose keys hex-encoded', () => {
    const vaultWSExecutionStep = [
      {
        stepId: 'some-step-id',
        appKey: vaultWorkspace.key,
        dataOut: {
          '4974732d612d6d65': 'Mario!', // key is hex-encoded `Its a me`
          _metadata: {
            keysEncoded: true,
          },
        },
      } as unknown as ExecutionStep,
    ]
    const params = {
      toSubstitute: 'Its a me {{step.some-step-id.Its-a-me}}',
    }
    const expected = {
      toSubstitute: 'Its a me Mario!',
    }
    const result = computeParameters(params, vaultWSExecutionStep)
    expect(result).toEqual(expected)
  })
})
