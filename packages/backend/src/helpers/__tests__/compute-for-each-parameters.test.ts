import { IExecutionStep } from '@plumber/types'

import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import {
  FOR_EACH_ITERATION_KEY,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import Flow from '@/models/flow'

import {
  computeForEachParameters,
  ForEachContext,
  getForEachContext,
} from '../compute-for-each-parameters'

const triggerId = randomUUID()
const randomForEachStepId = randomUUID()
const randomAction1StepId = randomUUID()
const randomAction2StepId = randomUUID()

const mockTriggerExecutionStep = {
  stepId: triggerId,
  appKey: 'test-app',
  key: 'test-action',
  dataOut: {
    stringProp: 'test string',
    numberProp: 42,
    arrayProp: ['item1', 'item2', 'item3'],
    checkboxProp: [
      { name: 'option1', value: true },
      { name: 'option2', value: false },
      { name: 'option3', value: true },
    ],
    tableProp: {
      rows: [
        { data: { id: 1, name: 'John', age: 25 } },
        { data: { id: 2, name: 'Jane', age: 30 } },
      ],
      columns: [
        { id: 'id', name: 'ID', value: 'id' },
        { id: 'name', name: 'Name', value: 'name' },
        { id: 'age', name: 'Age', value: 'age' },
      ],
    },
  },
} as unknown as IExecutionStep

const mockForEachCheckboxExecutionStep = {
  stepId: randomForEachStepId,
  appKey: TOOLBOX_APP_KEY,
  key: TOOLBOX_ACTIONS.FOR_EACH,
  dataOut: {
    item: 'items.__ITERATION__',
    items: ['Option 4', 'Option 3', 'Option 2', 'Option 1'],
    iterations: 4,
    inputSource: 'checkbox',
  },
} as unknown as IExecutionStep

const mockForEachTableExecutionStep = {
  stepId: randomForEachStepId,
  appKey: TOOLBOX_APP_KEY,
  key: TOOLBOX_ACTIONS.FOR_EACH,
  dataOut: {
    items: {
      rows: [
        {
          data: {
            '11167042-c7dc-447c-a08c-9694d44e7cab': 'Yes',
            '4d847712-89f4-4339-bbca-b5fc066a7bf8': 'T7822950K',
            '6d673eaa-fa43-4a5e-bd0f-cd5737ed6538':
              'Block 97 Ang Mo Kio Avenue #1-846',
            'a7e29b3c-ef08-4016-964f-9226ce85325e': 'Li Hua',
            'adde3dbe-d88c-4ca3-96a8-9c0b0122b8a6': 'hello',
            'b3313cc9-27cc-465f-83c4-20fee42d59c1': 'lihua.lim957@outlook.com',
            'e6269e93-d869-4384-9e1d-fdd127e4287f': 109480,
            'f7d2cc56-672a-4485-8bd6-b359b3ac8343': 'Lim',
          },
          rowId: 'dc8984b2-7521-412d-8698-c0c21f754922',
        },
        {
          data: {
            '11167042-c7dc-447c-a08c-9694d44e7cab': 'Yes',
            '4d847712-89f4-4339-bbca-b5fc066a7bf8': 'S7586967P',
            '6d673eaa-fa43-4a5e-bd0f-cd5737ed6538':
              'Block 422 Raffles Place #2-545',
            'a7e29b3c-ef08-4016-964f-9226ce85325e': 'Isaac',
            'b3313cc9-27cc-465f-83c4-20fee42d59c1': 'john.goh704@gmail.com',
            'e6269e93-d869-4384-9e1d-fdd127e4287f': 278127,
            'f7d2cc56-672a-4485-8bd6-b359b3ac8343': 'Goh',
          },
          rowId: '98040a94-5c10-4eab-ae4b-587c79ae5ed0',
        },
        {
          data: {
            '11167042-c7dc-447c-a08c-9694d44e7cab': 'Yes',
            '4d847712-89f4-4339-bbca-b5fc066a7bf8': 'S4654108U',
            '6d673eaa-fa43-4a5e-bd0f-cd5737ed6538':
              'Block 771 Holland Road #47-552',
            'a7e29b3c-ef08-4016-964f-9226ce85325e': 'Wei Ming',
            'b3313cc9-27cc-465f-83c4-20fee42d59c1':
              'weiming.singh717@hotmail.com',
            'e6269e93-d869-4384-9e1d-fdd127e4287f': 805877,
            'f7d2cc56-672a-4485-8bd6-b359b3ac8343': 'Singh',
          },
          rowId: '88464fa3-acb5-454c-904f-bb72dc153a5d',
        },
        {
          data: {
            '11167042-c7dc-447c-a08c-9694d44e7cab': 'Yes',
            '4d847712-89f4-4339-bbca-b5fc066a7bf8': 'S3257627G',
            '6d673eaa-fa43-4a5e-bd0f-cd5737ed6538':
              'Block 775 Jurong West Street #35-435',
            'a7e29b3c-ef08-4016-964f-9226ce85325e': 'Kumar',
            'adde3dbe-d88c-4ca3-96a8-9c0b0122b8a6': 'bye',
            'b3313cc9-27cc-465f-83c4-20fee42d59c1': 'kumar.chen803@gmail.com',
            'e6269e93-d869-4384-9e1d-fdd127e4287f': 813351,
            'f7d2cc56-672a-4485-8bd6-b359b3ac8343': 'Chen',
          },
          rowId: '13628595-dd01-4cb8-a6bd-fac80373441a',
        },
      ],
      columns: [
        {
          id: 'a7e29b3c-ef08-4016-964f-9226ce85325e',
          name: 'First Name',
          value:
            'items.rows.__ITERATION__.data.a7e29b3c-ef08-4016-964f-9226ce85325e',
        },
        {
          id: 'f7d2cc56-672a-4485-8bd6-b359b3ac8343',
          name: 'Last Name',
          value:
            'items.rows.__ITERATION__.data.f7d2cc56-672a-4485-8bd6-b359b3ac8343',
        },
        {
          id: '4d847712-89f4-4339-bbca-b5fc066a7bf8',
          name: 'NRIC',
          value:
            'items.rows.__ITERATION__.data.4d847712-89f4-4339-bbca-b5fc066a7bf8',
        },
        {
          id: '6d673eaa-fa43-4a5e-bd0f-cd5737ed6538',
          name: 'Address',
          value:
            'items.rows.__ITERATION__.data.6d673eaa-fa43-4a5e-bd0f-cd5737ed6538',
        },
        {
          id: 'e6269e93-d869-4384-9e1d-fdd127e4287f',
          name: 'Postal Code',
          value:
            'items.rows.__ITERATION__.data.e6269e93-d869-4384-9e1d-fdd127e4287f',
        },
        {
          id: 'b3313cc9-27cc-465f-83c4-20fee42d59c1',
          name: 'Email Address',
          value:
            'items.rows.__ITERATION__.data.b3313cc9-27cc-465f-83c4-20fee42d59c1',
        },
        {
          id: '11167042-c7dc-447c-a08c-9694d44e7cab',
          name: 'RSVP-ed?',
          value:
            'items.rows.__ITERATION__.data.11167042-c7dc-447c-a08c-9694d44e7cab',
        },
        {
          id: 'adde3dbe-d88c-4ca3-96a8-9c0b0122b8a6',
          name: 'Test',
          value:
            'items.rows.__ITERATION__.data.adde3dbe-d88c-4ca3-96a8-9c0b0122b8a6',
        },
        {
          id: '62ead552-d117-48c4-930a-9fe7a110e2ec',
          name: 'Test',
          value:
            'items.rows.__ITERATION__.data.62ead552-d117-48c4-930a-9fe7a110e2ec',
        },
      ],
    },
    iterations: 4,
    inputSource: 'tiles',
  },
} as unknown as IExecutionStep

const mockExecutionStepsAfterForEach = [
  {
    stepId: randomAction1StepId,
    appKey: 'test-app',
    key: 'test-action',
    dataOut: {
      stringProp: 'iteration 1 step 3 string',
      numberProp: 84,
      objectProp: {
        stringProp: 'iteration 1 step 3 string in object',
        numberProp: 840,
      },
    },
    metadata: { iteration: 1 },
  },
  {
    stepId: randomAction1StepId,
    appKey: 'test-app',
    key: 'test-action',
    dataOut: {
      stringProp: 'iteration 2 step 3 string',
      numberProp: 84,
      objectProp: {
        stringProp: 'iteration 2 step 3 string in object',
        numberProp: 840,
      },
    },
    metadata: { iteration: 2 },
  },
  {
    stepId: randomAction2StepId,
    appKey: 'test-app',
    key: 'test-action',
    dataOut: {
      stringProp: 'iteration 2 step 4 string',
      numberProp: 126,
      objectProp: {
        stringProp: 'iteration 2 step 4 string in object',
        numberProp: 1260,
      },
    },
    metadata: { iteration: 2 },
  },
  {
    stepId: randomAction2StepId,
    appKey: 'test-app',
    key: 'test-action',
    dataOut: {
      stringProp: 'iteration 3 step 4 string',
      numberProp: 126,
      objectProp: {
        stringProp: 'iteration 3 step 4 string in object',
        numberProp: 1260,
      },
    },
    metadata: { iteration: 3 },
  },
] as unknown as IExecutionStep[]

const mockExecutionStepsCheckbox: IExecutionStep[] = [
  mockTriggerExecutionStep,
  mockForEachCheckboxExecutionStep,
  ...mockExecutionStepsAfterForEach,
]

const mockExecutionStepsTable: IExecutionStep[] = [
  mockTriggerExecutionStep,
  mockForEachTableExecutionStep,
  ...mockExecutionStepsAfterForEach,
]

const mockFlow = {
  steps: [
    {
      id: triggerId,
      position: 1,
      appKey: 'test-app',
      key: 'test-action',
    },
    {
      id: randomForEachStepId,
      position: 2,
      appKey: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.FOR_EACH,
    },
    {
      id: randomAction1StepId,
      position: 3,
      appKey: 'test-app',
      key: 'test-action-after-foreach',
    },
    {
      id: randomAction2StepId,
      position: 4,
      appKey: 'test-app',
      key: 'test-action-after-foreach',
    },
  ],
} as unknown as Flow

describe('getForEachContext', () => {
  it('should return correct context when no for-each step exists', () => {
    const flowWithoutForEach = {
      steps: [
        {
          id: triggerId,
          position: 1,
          appKey: 'test-app',
          key: 'test-action',
        },
      ],
    } as unknown as Flow

    const context = getForEachContext(flowWithoutForEach, 1)

    expect(context).toEqual({
      forEachStepIndex: -1,
      stepIsInForEach: false,
      stepPositions: {},
    })
  })

  it('should return correct context when step is in for-each', () => {
    const flowWithMultipleForEach = {
      steps: [
        {
          id: randomUUID(),
          position: 1,
          appKey: 'formsg',
          key: 'newSubmission',
        },
        {
          id: randomUUID(),
          position: 2,
          appKey: TOOLBOX_APP_KEY,
          key: TOOLBOX_ACTIONS.FOR_EACH,
        },
        {
          id: randomUUID(),
          position: 3,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
        },
      ],
    } as unknown as Flow

    const context = getForEachContext(flowWithMultipleForEach, 3)

    expect(context.forEachStepIndex).toBe(2)
    expect(context.stepIsInForEach).toBe(true)
  })

  it('should return correct context when step is before for-each', () => {
    const context = getForEachContext(mockFlow, 1)

    expect(context.forEachStepIndex).toBe(2)
    expect(context.stepIsInForEach).toBe(false)
  })

  it('should return correct context when step is after for-each', () => {
    const context = getForEachContext(mockFlow, 3)

    expect(context.forEachStepIndex).toBe(2)
    expect(context.stepIsInForEach).toBe(true)
  })

  it('should return correct step positions', () => {
    const context = getForEachContext(mockFlow, 1)

    expect(context.stepPositions).toEqual({
      [mockFlow.steps[0].id]: 1,
      [mockFlow.steps[1].id]: 2,
      [mockFlow.steps[2].id]: 3,
      [mockFlow.steps[3].id]: 4,
    })
  })
})

describe('computeForEachParameters', () => {
  const baseIteration = 2
  const baseForEachContext: ForEachContext = {
    testRun: false,
    executionStepMetadata: { iteration: baseIteration },
    forEachStepIndex: 2,
    stepIsInForEach: true,
    stepPositions: {
      [mockFlow.steps[0].id]: 1,
      [mockFlow.steps[1].id]: 2,
      [mockFlow.steps[2].id]: 3,
      [mockFlow.steps[3].id]: 4,
    },
  }

  it.each([
    { iteration: 1, expected: 'Option 4' },
    { iteration: 2, expected: 'Option 3' },
    { iteration: 3, expected: 'Option 2' },
    { iteration: 4, expected: 'Option 1' },
    { iteration: 5, expected: '' },
  ])(
    'should handle checkbox data retrieval from for-each step %s',
    ({ iteration, expected }) => {
      const keyPath = `item`

      const executionStep = mockExecutionStepsCheckbox[1] // for-each step

      const result = computeForEachParameters({
        data: executionStep.dataOut,
        keyPath,
        executionSteps: mockExecutionStepsCheckbox,
        executionStep,
        stepId: randomForEachStepId,
        forEachContext: {
          ...baseForEachContext,
          executionStepMetadata: { iteration },
        },
      })
      expect(result).toEqual(expected)
    },
  )

  it.each([
    { keyPath: `items.columns.0.value`, iteration: 1, expected: 'Li Hua' },
    { keyPath: `items.columns.0.value`, iteration: 2, expected: 'Isaac' },
    { keyPath: `items.columns.0.value`, iteration: 3, expected: 'Wei Ming' },
    { keyPath: `items.columns.0.value`, iteration: 4, expected: 'Kumar' },
    { keyPath: `items.columns.1.value`, iteration: 1, expected: 'Lim' },
    { keyPath: `items.columns.1.value`, iteration: 2, expected: 'Goh' },
    { keyPath: `items.columns.1.value`, iteration: 3, expected: 'Singh' },
    { keyPath: `items.columns.1.value`, iteration: 4, expected: 'Chen' },
    { keyPath: `items.columns.4.value`, iteration: 1, expected: 109480 },
    { keyPath: `items.columns.4.value`, iteration: 2, expected: 278127 },
    { keyPath: `items.columns.4.value`, iteration: 3, expected: 805877 },
    { keyPath: `items.columns.4.value`, iteration: 4, expected: 813351 },
    { keyPath: `items.columns.7.value`, iteration: 1, expected: 'hello' },
    { keyPath: `items.columns.7.value`, iteration: 2, expected: '' },
    { keyPath: `items.columns.7.value`, iteration: 3, expected: '' },
    { keyPath: `items.columns.7.value`, iteration: 4, expected: 'bye' },
  ])(
    'should handle table data retrieval from for-each step',
    ({ keyPath, iteration, expected }) => {
      const executionStep = mockExecutionStepsTable[1] // for-each step
      const result = computeForEachParameters({
        data: executionStep.dataOut,
        keyPath,
        executionSteps: mockExecutionStepsTable,
        executionStep,
        stepId: randomForEachStepId,
        forEachContext: {
          ...baseForEachContext,
          executionStepMetadata: { iteration },
        },
      })
      // console.log('result', result)
      expect(result).toEqual(expected)
    },
  )

  it.each([
    { keyPath: 'stringProp', expected: 'iteration 2 step 3 string' },
    { keyPath: 'numberProp', expected: 84 },
    {
      keyPath: 'objectProp.stringProp',
      expected: 'iteration 2 step 3 string in object',
    },
    { keyPath: 'objectProp.numberProp', expected: 840 },
  ])(
    'should handle data retrieval from the correct iteration for an action step inside the for-each step',
    ({ keyPath, expected }) => {
      const executionStep = mockExecutionStepsAfterForEach[0]
      const result = computeForEachParameters({
        data: executionStep.dataOut,
        keyPath,
        executionSteps: mockExecutionStepsTable,
        executionStep,
        stepId: randomAction1StepId,
        forEachContext: baseForEachContext,
      })
      expect(result).toEqual(expected)
    },
  )

  it('should handle non-existent step id', () => {
    const executionStep = mockExecutionStepsAfterForEach[0]
    const result = computeForEachParameters({
      data: executionStep.dataOut,
      keyPath: 'stringProp',
      executionSteps: mockExecutionStepsAfterForEach,
      executionStep: mockExecutionStepsAfterForEach[0],
      stepId: 'non-existent-step-id',
      forEachContext: baseForEachContext,
    })
    expect(result).toEqual('')
  })

  it('should handle missing forEachContext gracefully', () => {
    const keyPath = `items.columns.${FOR_EACH_ITERATION_KEY}.value`
    const executionStep = mockExecutionStepsCheckbox[2]
    const result = computeForEachParameters({
      data: executionStep.dataOut,
      keyPath,
      executionSteps: mockExecutionStepsCheckbox,
      executionStep,
      stepId: randomAction1StepId,
      forEachContext: undefined as any,
    })

    expect(result).toBe(keyPath) // returns keyPath when context is missing
  })

  it('should handle undefined metadata.iteration gracefully', () => {
    const keyPath = `items.columns.${FOR_EACH_ITERATION_KEY}.value`
    const executionStep = mockExecutionStepsTable[1] // for-each step

    const result = computeForEachParameters({
      data: executionStep.dataOut,
      keyPath,
      executionSteps: mockExecutionStepsTable,
      executionStep,
      stepId: randomForEachStepId,
      forEachContext: {
        ...baseForEachContext,
        executionStepMetadata: {},
      },
    })

    expect(result).toBe('')
  })
})
