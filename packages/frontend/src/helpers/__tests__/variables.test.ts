import { IStep } from '@plumber/types'

import {
  extractVariables,
  filterVariables,
  StepWithVariables,
} from 'helpers/variables'
import { beforeEach, describe, expect, it } from 'vitest'

describe('variables', () => {
  describe('extractVariables', () => {
    let steps: IStep[]

    beforeEach(() => {
      steps = [
        {
          id: 'step1-id',
          appKey: 'app1',
          executionSteps: [
            {
              dataOut: {
                stringProp: 'string value',
              },
            },
          ],
        },
      ] as unknown as IStep[]
    })

    it('extracts variables from every step', () => {
      steps.push({
        id: 'step2-id',
        appKey: 'app2',
        executionSteps: [
          {
            dataOut: {
              numberProp: 456,
            },
          },
        ],
      } as unknown as IStep)

      const result = extractVariables(steps)
      expect(result).toEqual([
        {
          id: 'step1-id',
          name: '1. App1',
          output: [
            // Use objectContaining to avoid enumerating all metadata props
            expect.objectContaining({
              name: 'step.step1-id.stringProp',
              value: 'string value',
            }),
          ],
        },
        {
          id: 'step2-id',
          name: '2. App2',
          output: [
            expect.objectContaining({
              name: 'step.step2-id.numberProp',
              value: 456,
            }),
          ],
        },
      ])
    })

    describe('extracts variables from complex thingys', () => {
      it('handles nested objects', () => {
        steps[0].executionSteps[0].dataOut.objectProp = {
          a: 1,
          b: 'str-2',
        }

        const result = extractVariables(steps)
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.stringProp',
            value: 'string value',
          }),
          expect.objectContaining({
            name: 'step.step1-id.objectProp.a',
            value: 1,
          }),
          expect.objectContaining({
            name: 'step.step1-id.objectProp.b',
            value: 'str-2',
          }),
        ])
      })

      it('handles arrays', () => {
        steps[0].executionSteps[0].dataOut.arrayProp = [
          9000,
          'HI THAR',
          { c: '1', d: 2 },
        ]

        const result = extractVariables(steps)
        // label exists because no metadata is provided
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.stringProp',
            value: 'string value',
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.0',
            label: 'arrayProp.0',
            value: 9000,
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.1',
            label: 'arrayProp.1',
            value: 'HI THAR',
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.2.c',
            label: 'arrayProp.2.c',
            value: '1',
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.2.d',
            label: 'arrayProp.2.d',
            value: 2,
          }),
        ])
      })
    })

    // Sanity check with label metadatum only; hence the use of objectContaining
    describe('adds metadata to all prop types', () => {
      it('adds to primitive props', () => {
        steps[0].executionSteps[0].dataOutMetadata = {
          stringProp: {
            label: 'test label',
          },
        }
        const result = extractVariables(steps)
        expect(result[0].output[0]).toEqual(
          expect.objectContaining({
            name: 'step.step1-id.stringProp',
            label: 'test label',
            value: 'string value',
          }),
        )
      })

      it('adds to nested object props', () => {
        steps[0].executionSteps[0].dataOut = {
          objectProp: {
            a: 1,
            b: 'stringy 2',
          },
        }
        steps[0].executionSteps[0].dataOutMetadata = {
          objectProp: {
            a: { label: 'label a' },
            b: { label: 'label b' },
          },
        }
        const result = extractVariables(steps)
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.objectProp.a',
            label: 'label a',
            value: 1,
          }),
          expect.objectContaining({
            name: 'step.step1-id.objectProp.b',
            label: 'label b',
            value: 'stringy 2',
          }),
        ])
      })

      it('adds to array props', () => {
        steps[0].executionSteps[0].dataOut = {
          arrayProp: [9000, 'HI THAR', { c: '1', d: 2 }],
        }
        steps[0].executionSteps[0].dataOutMetadata = {
          arrayProp: [
            { label: 'label 9000' },
            { label: 'label HI THAR' },
            { c: { label: 'label c prop' }, d: { label: 'label d prop' } },
          ],
        }
        const result = extractVariables(steps)
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.0',
            label: 'label 9000',
            value: 9000,
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.1',
            label: 'label HI THAR',
            value: 'HI THAR',
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.2.c',
            label: 'label c prop',
            value: '1',
          }),
          expect.objectContaining({
            name: 'step.step1-id.arrayProp.2.d',
            label: 'label d prop',
            value: 2,
          }),
        ])
      })
    })

    describe.each([
      { metadataPropName: 'label', sampleMetadata: { label: 'test label' } },
      { metadataPropName: 'type', sampleMetadata: { type: 'text' } },
      {
        metadataPropName: 'displayedValue',
        sampleMetadata: { displayedValue: 'pretty value' },
      },
    ])(
      'processes metadata into props',
      ({ metadataPropName, sampleMetadata }) => {
        it('adds corresponding prop if present', () => {
          steps[0].executionSteps[0].dataOutMetadata = {
            stringProp: sampleMetadata,
          }
          const result = extractVariables(steps)
          expect(result[0].output[0]).toEqual(
            expect.objectContaining(sampleMetadata),
          )
        })

        it('sets corresponding prop to null if absent, label exists because no metadata is provided', () => {
          const result = extractVariables(steps)
          expect(result[0].output[0]).toEqual(
            expect.objectContaining({
              [metadataPropName]: null,
              label: 'stringProp',
            }),
          )
        })
      },
    )

    describe('processes order metadata', () => {
      it('adds order metadata if present', () => {
        steps[0].executionSteps[0].dataOutMetadata = {
          stringProp: {
            order: 10.4,
          },
        }
        const result = extractVariables(steps)
        expect(result[0].output[0]).toEqual(
          expect.objectContaining({
            order: 10.4,
          }),
        )
      })

      it('sets order prop to null if absent', () => {
        const result = extractVariables(steps)
        expect(result[0].output[0]).toEqual(
          expect.objectContaining({
            order: null,
          }),
        )
      })

      it('outputs variables as dictated by order', () => {
        steps[0].executionSteps[0].dataOut = {
          stringProp: 'a',
          stringProp2: 'b',
          stringProp3: 'c',
          stringProp4: 'd',
        }
        steps[0].executionSteps[0].dataOutMetadata = {
          stringProp: { order: 10 },
          stringProp2: { order: 10.2 },
          // Intentionally undefined order for stringProp3 and
          // stringProp4
        }
        const result = extractVariables(steps)
        expect(result[0].output).toEqual([
          expect.objectContaining({
            value: 'a',
            order: 10,
          }),
          expect.objectContaining({
            value: 'b',
            order: 10.2,
          }),
          // Check sort stability
          expect.objectContaining({
            value: 'c',
          }),
          expect.objectContaining({
            value: 'd',
          }),
        ])
      })
    })

    describe('process arrays in dataout', () => {
      it('data without formsg checkbox field will have the array flat-mapped', () => {
        steps[0].executionSteps[0].dataOut = {
          recipients: ['coolbeans@open.gov.sg', 'plumbros@open.gov.sg'],
        }

        const result = extractVariables(steps)
        // label exists because no metadata is provided
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.recipients.0',
            label: 'recipients.0',
            value: 'coolbeans@open.gov.sg',
          }),
          expect.objectContaining({
            name: 'step.step1-id.recipients.1',
            label: 'recipients.1',
            value: 'plumbros@open.gov.sg',
          }),
        ])
      })

      it('data with formsg checkbox field will not have the array flat-mapped', () => {
        steps[0].executionSteps[0].dataOut = {
          fields: {
            field1: {
              order: 1,
              question: 'Have you eaten your meals?',
              fieldType: 'checkbox',
              answerArray: ['Lunch', 'Dinner'],
            },
          },
        }
        // only include metadata for answerArray for testing purposes
        steps[0].executionSteps[0].dataOutMetadata = {
          fields: {
            field1: {
              answerArray: {
                type: 'array',
                label: 'test label',
                order: 1.1,
              },
            },
          },
        }

        const result = extractVariables(steps)
        // answerArray object will be at the top due to an order given
        expect(result[0].output).toEqual([
          expect.objectContaining({
            name: 'step.step1-id.fields.field1.answerArray',
            label: 'test label',
            value: 'Lunch, Dinner',
            type: 'array',
            displayedValue: null,
            order: 1.1,
          }),
          expect.objectContaining({
            name: 'step.step1-id.fields.field1.order',
            label: 'fields.field1.order',
            value: 1,
            type: null,
            displayedValue: null,
            order: null,
          }),
          expect.objectContaining({
            name: 'step.step1-id.fields.field1.question',
            label: 'fields.field1.question',
            value: 'Have you eaten your meals?',
            type: null,
            displayedValue: null,
            order: null,
          }),
          expect.objectContaining({
            name: 'step.step1-id.fields.field1.fieldType',
            label: 'fields.field1.fieldType',
            value: 'checkbox',
            type: null,
            displayedValue: null,
            order: null,
          }),
        ])
      })
    })
  })

  describe('filterVariables', () => {
    let stepsWithVariables: StepWithVariables[]

    beforeEach(() => {
      stepsWithVariables = [
        {
          id: 'step1-id',
          name: '1. Step 1',
          output: [
            {
              label: 'Text variable',
              type: 'text',
              order: 1,
              displayedValue: null,
              name: 'step1-id.abc-def.textVar',
              value: 'abcd',
            },
            {
              label: 'File variable',
              type: 'file',
              order: 2,
              displayedValue: null,
              name: 'step1-id.abc-def.fileVar',
              value: '01010010010',
            },
          ],
        },
        {
          id: 'step2-id',
          name: '2. Step 2',
          output: [
            {
              label: 'Another text variable',
              type: 'text',
              order: 1,
              displayedValue: null,
              name: 'step2-id.wx-yz.anotherTextVar',
              value: 'wxyz',
            },
          ],
        },
      ] as unknown as StepWithVariables[]
    })

    it('filters according to filter callback results', () => {
      const result = filterVariables(
        stepsWithVariables,
        (v) => v.type === 'text',
      )
      expect(result).toEqual([
        {
          id: 'step1-id',
          name: '1. Step 1',
          output: [
            {
              label: 'Text variable',
              type: 'text',
              order: 1,
              displayedValue: null,
              name: 'step1-id.abc-def.textVar',
              value: 'abcd',
            },
          ],
        },
        {
          id: 'step2-id',
          name: '2. Step 2',
          output: [
            {
              label: 'Another text variable',
              type: 'text',
              order: 1,
              displayedValue: null,
              name: 'step2-id.wx-yz.anotherTextVar',
              value: 'wxyz',
            },
          ],
        },
      ])
    })

    it('removes steps with no variables after filtering', () => {
      const result = filterVariables(
        stepsWithVariables,
        (v) => v.type === 'file',
      )
      expect(result).toEqual([
        {
          id: 'step1-id',
          name: '1. Step 1',
          output: [expect.objectContaining({ label: 'File variable' })],
        },
      ])
    })
  })
})
