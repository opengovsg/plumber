import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import ExecutionStep from '@/models/execution-step'

import computeParameters from '../compute-parameters'

const randomStepID = randomUUID()

const executionSteps = [
  {
    stepId: randomStepID,
    dataOut: {
      stringProp: 'string value',
      numberProp: 123,
      'space separated prop': 'space separated value',
      arrayProp: ['array value 1', 'hehe', 'array value 3'], // for-each intro
    },
  } as unknown as ExecutionStep,
]

describe('compute parameters', () => {
  it.each([
    {
      testDescription: 'strings',
      params: {
        paramWithStringVar: `herp! {{step.${randomStepID}.stringProp}}`,
        paramWithNumberVar: `derp! {{step.${randomStepID}.numberProp}}`,
        paramWithSpaceVar: `derp! {{step.${randomStepID}.space separated prop}}`,
      },
      expected: {
        paramWithStringVar: 'herp! string value',
        paramWithNumberVar: 'derp! 123',
        paramWithSpaceVar: `derp! space separated value`,
      },
    },
    {
      testDescription: 'string arrays',
      params: {
        arrayParam: [
          `{{step.${randomStepID}.stringProp}}`,
          `{{step.${randomStepID}.numberProp}}`,
          `{{step.${randomStepID}.space separated prop}}`,
        ],
      },
      expected: {
        arrayParam: [
          'string value',
          // this is expected to be string; we preserve the original type
          '123',
          'space separated value',
        ],
      },
    },
    {
      testDescription: 'non-nested objects',
      params: {
        objectParam: {
          key1: `prefix {{step.${randomStepID}.stringProp}}`,
          key2: `{{step.${randomStepID}.numberProp}}`,
          key3: `{{step.${randomStepID}.space separated prop}}`,
        },
      },
      expected: {
        objectParam: {
          key1: 'prefix string value',
          key2: '123',
          key3: `space separated value`,
        },
      },
    },
    {
      testDescription: 'arrays of non-nested objects',
      params: {
        arrayParam: [
          {
            key1: `object 1 - {{step.${randomStepID}.stringProp}}`,
          },
          {
            key1: `object 2 - {{step.${randomStepID}.numberProp}}`,
          },
          {
            key1: `object 3 - {{step.${randomStepID}.space separated prop}}`,
          },
          {
            key1: `object 4 - {{step.${randomStepID}.arrayProp}}`,
          },
        ],
      },
      expected: {
        arrayParam: [
          { key1: 'object 1 - string value' },
          { key1: 'object 2 - 123' },
          { key1: 'object 3 - space separated value' },
          { key1: 'object 4 - array value 1, hehe, array value 3' },
        ],
      },
    },
    {
      testDescription: 'nested objects',
      params: {
        objectParam: {
          subObject: {
            key1: `{{step.${randomStepID}.numberProp}}`,
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
            `{{step.${randomStepID}.numberProp}}`,
            `{{step.${randomStepID}.stringProp}}`,
            `{{step.${randomStepID}.space separated prop}}`,
          ],
        },
      },
      expected: {
        objectParam: {
          key1: ['123', 'string value', 'space separated value'],
        },
      },
    },
    {
      testDescription: 'nested objects with an array prop',
      params: {
        objectParam: {
          subObject: {
            key1: `{{step.${randomStepID}.numberProp}}`,
            key2: `{{step.${randomStepID}.arrayProp}} and more...`,
          },
        },
      },
      expected: {
        objectParam: {
          subObject: {
            key1: '123',
            key2: 'array value 1, hehe, array value 3 and more...',
          },
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
            { deepNest: `{{step.${randomStepID}.stringProp}} suffix` },
            8000,
            `{{step.${randomStepID}.stringProp}}`,
          ],
        },
        mixedArrayParam: [
          `herp! {{step.${randomStepID}.stringProp}}`,
          9000,
          {
            key1: `{{step.${randomStepID}.stringProp}} suffix`,
            nestedArray: [
              'zzz',
              '',
              `{{step.${randomStepID}.stringProp}}`,
              8888,
            ],
            anotherObject: {
              xyz: `{{step.${randomStepID}.numberProp}}`,
              abc: 'kek',
            },
          },
          `{{step.${randomStepID}.numberProp}}`,
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

  it('should work with space separated keys', () => {
    const executionStep = [
      {
        stepId: randomStepID,
        appKey: 'test-app',
        dataOut: {
          '   weopfkweopf     ': 'Itsa me',
          'weiofjwef wefwe fwe fwefwe f  ': 'Mario!',
        },
      } as unknown as ExecutionStep,
    ]
    const params = {
      toSubstitute: `{{step.${randomStepID}.   weopfkweopf     }} {{step.${randomStepID}.weiofjwef wefwe fwe fwefwe f  }}`,
    }
    const expected = {
      toSubstitute: 'Itsa me Mario!',
    }
    const result = computeParameters(params, executionStep)
    expect(result).toEqual(expected)
  })

  it('should not replace parameters with tabs or newlines', () => {
    const executionStep = [
      {
        stepId: randomStepID,
        appKey: 'test-app',
        dataOut: {
          '\tab tab\t': 'Itsa me',
          'newlines\n': 'Mario!',
        },
      } as unknown as ExecutionStep,
    ]
    const params = {
      toSubstitute: `{{step.${randomStepID}.\tab tab\t}} {{step.${randomStepID}.newlines\n}}`,
    }
    const expected = {
      toSubstitute: `{{step.${randomStepID}.\tab tab\t}} {{step.${randomStepID}.newlines\n}}`,
    }
    const result = computeParameters(params, executionStep)
    expect(result).toEqual(expected)
  })

  it('should process parameters with underscores in keys', () => {
    const executionStep = [
      {
        stepId: randomStepID,
        dataOut: {
          childrenbirthrecords_abc_childdateofbirth_0: {
            fieldType: 'children',
            question: 'Child Date of birth',
            answer: '31/03/2017',
            order: 1,
          },
          childrenbirthrecords_abc_childname_0: {
            fieldType: 'children',
            question: 'Child Name',
            answer: 'John Doe',
            order: 2,
          },
        },
      } as unknown as ExecutionStep,
    ]
    const params = {
      toSubstitute: `{{step.${randomStepID}.childrenbirthrecords_abc_childdateofbirth_0.answer}} {{step.${randomStepID}.childrenbirthrecords_abc_childname_0.answer}}`,
    }
    const expected = {
      toSubstitute: `31/03/2017 John Doe`,
    }
    const result = computeParameters(params, executionStep)
    expect(result).toEqual(expected)
  })

  it.each([
    {
      testDescription: 'compute wildcard on array of objects to get strings',
      params: `wildcard get strings {{step.${randomStepID}.arrayOfObjectsProp.*.stringProp}}`,
      expected:
        'wildcard get strings string value 1 in array of objects, string value 2 in array of objects',
    },
    {
      testDescription: 'compute wildcard on array of objects to get numbers',
      params: `wildcard get numbers {{step.${randomStepID}.arrayOfObjectsProp.*.numberProp}}`,
      expected: 'wildcard get numbers 456, 789',
    },
    {
      testDescription: 'compute wildcard on both strings and numbers',
      params: `wildcard get strings and numbers {{step.${randomStepID}.arrayOfObjectsProp.*.stringProp}} {{step.${randomStepID}.arrayOfObjectsProp.*.numberProp}}`,
      expected:
        'wildcard get strings and numbers string value 1 in array of objects, string value 2 in array of objects 456, 789',
    },
    {
      testDescription: 'compute wildcard on non-existent key',
      params: `non-existent key! {{step.${randomStepID}.non-existent-key.*.id}}`,
      expected: 'non-existent key! ',
    },
    {
      testDescription: 'compute wildcard on a string',
      params: `wildcard on a string!! {{step.${randomStepID}.stringProp.*.id}}`,
      expected: 'wildcard on a string!! string value',
    },
    {
      testDescription: 'ignore wildcard at end of variable',
      params: `empty!! {{step.${randomStepID}.emptyArrayProp.*}}`,
      expected: `empty!! {{step.${randomStepID}.emptyArrayProp.*}}`,
    },
    {
      testDescription: 'ignore wildcard inside the key',
      params: `wildcard inside the key {{step.${randomStepID}.stringProp*}}`,
      expected: `wildcard inside the key {{step.${randomStepID}.stringProp*}}`,
    },
    {
      testDescription: 'ignore more than one wildcard inside the variable',
      params: `two wildcards inside the key {{step.${randomStepID}.*.stringProp.*}}`,
      expected: `two wildcards inside the key {{step.${randomStepID}.*.stringProp.*}}`,
    },
  ])('should $testDescription', ({ params, expected }) => {
    const executionSteps = [
      {
        stepId: randomStepID,
        dataOut: {
          stringProp: 'string value',
          numberProp: 123,
          'space separated prop': 'space separated value',
          arrayProp: ['array value 1', 'hehe', 'array value 3'],
          emptyArrayProp: [],
          arrayOfObjectsProp: [
            {
              stringProp: 'string value 1 in array of objects',
              numberProp: 456,
            },
            {
              stringProp: 'string value 2 in array of objects',
              numberProp: 789,
            },
          ],
        },
      } as unknown as ExecutionStep,
    ]

    const result = computeParameters({ params }, executionSteps)
    expect(result).toEqual({ params: expected })
  })
})
