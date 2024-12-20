import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import ExecutionStep from '@/models/execution-step'

import computeParameters, { getDataValue } from '../compute-parameters'

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

  it('should work with single keys with dots', () => {
    const randomKey = randomUUID()
    const executionStep = [
      {
        stepId: randomStepID,
        dataOut: {
          fields: {
            [`${randomKey}.b.c`]: 'Itsa me',
          },
        },
      } as unknown as ExecutionStep,
    ]
    const params = {
      toSubstitute: `{{step.${randomStepID}.fields.${randomKey}.b.c}}`,
    }
    const expected = {
      toSubstitute: 'Itsa me',
    }
    const result = computeParameters(params, executionStep)
    expect(result).toEqual(expected)
  })
})

describe('getDataValue', () => {
  it('should retrieve simple properties', () => {
    const obj = {
      simple: 'value',
      'with space': 'spaced value',
    }

    expect(getDataValue(obj, 'simple')).toBe('value')
    expect(getDataValue(obj, 'with space')).toBe('spaced value')
  })

  it('should retrieve nested properties using dot notation', () => {
    const obj = {
      level1: {
        prop: 'correct value',
      },
    }

    expect(getDataValue(obj, 'level1.prop')).toBe('correct value')
  })

  it.each([
    {
      'a.b.c': 'wrong value',
      a: {
        b: {
          c: {
            d: 'correct value',
          },
        },
      },
    },
    {
      'a.b': {
        'c.d': 'correct value',
      },
      'a.b.c': 'wrong value',
    },
  ])('should handle deeply nested properties', (obj) => {
    expect(getDataValue(obj, 'a.b.c.d')).toBe('correct value')
  })

  it('should handle arrays in objects', () => {
    const obj = {
      arr: ['first', 'second'],
    }

    expect(getDataValue(obj, 'arr.0')).toBe('first')
    expect(getDataValue(obj, 'arr.1')).toBe('second')
  })

  it('should prioritize exact matches over nested paths', () => {
    const obj = {
      a: {
        b: {
          c: 'correct value',
        },
      },
      'a.b': {
        c: 'nested value',
      },
    }

    expect(getDataValue(obj, 'a.b.c')).toBe('correct value')

    const obj2 = {
      a: {
        b: 'wrong value',
      },
      'a.b.c': 'correct value',
    }
    expect(getDataValue(obj2, 'a.b.c')).toBe('correct value')
  })

  it('should return undefined for non-existent paths', () => {
    const obj = {
      a: {
        b: 'value',
      },
    }

    expect(getDataValue(obj, 'a.c')).toBeUndefined()
    expect(getDataValue(obj, 'x.y.z')).toBeUndefined()
  })

  it('should return undefined if input is null or undefined', () => {
    expect(getDataValue(null, 'a.b.c')).toBeUndefined()
    expect(getDataValue(undefined, 'a.b.c')).toBeUndefined()
  })

  it('should handle circular references', () => {
    const obj: any = {}
    obj.a = obj
    expect(getDataValue(obj, 'a')).toBeUndefined()

    // Add more test cases
    const obj2: any = { a: { b: {} } }
    obj2.a.b.c = obj2.a
    expect(getDataValue(obj2, 'a.b.c.b')).toBeUndefined()

    const obj3: any = { x: { y: { z: 'value' } } }
    obj3.x.y.cycle = obj3.x
    expect(getDataValue(obj3, 'x.y.cycle.y.z')).toBeUndefined()

    // Test single key circular reference
    const obj4: any = {}
    obj4.self = obj4
    expect(getDataValue(obj4, 'self')).toBeUndefined()

    // Test circular reference with primitive values
    const obj5: any = { a: 1 }
    obj5.b = obj5

    expect(getDataValue(obj5, 'b')).toBeUndefined()
    expect(getDataValue(obj5, 'b.a')).toBeUndefined()
  })
})
