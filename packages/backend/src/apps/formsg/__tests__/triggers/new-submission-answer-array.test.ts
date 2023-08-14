import { IExecutionStep } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import trigger from '../../triggers/new-submission'

describe('new submission trigger for checkbox answer array fields', () => {
  let executionStep: IExecutionStep

  beforeEach(() => {
    executionStep = {
      dataOut: {
        fields: {
          textFieldId: {
            question: 'Have you had your meals?',
            fieldType: 'checkbox',
            order: 1,
            answerArray: ['lunch', 'dinner'],
          },
        },
      },
    } as unknown as IExecutionStep
  })

  describe('dataOut metadata', () => {
    it('changes the question label to "Question #n"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.label).toEqual('Question 1')
    })

    it('changes the answerArray label to a group of selected responses', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const array = metadata.fields.textFieldId.answerArray

      for (let i = 0; i < array.length; i++) {
        expect(array[i].label).toEqual(`Response 1, Selected Option ${i + 1}`)
      }
    })
  })
})

describe('new submission trigger for table answer array fields', () => {
  let executionStep: IExecutionStep

  beforeEach(() => {
    executionStep = {
      dataOut: {
        fields: {
          textFieldId: {
            question: 'What are your hobbies? When do you do them?',
            fieldType: 'table',
            order: 1,
            answerArray: [
              ['sleeping', 'night'],
              ['eating', 'all day'],
            ],
          },
        },
      },
    } as unknown as IExecutionStep
  })

  describe('dataOut metadata', () => {
    it('changes the question label to "Question #n"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.label).toEqual('Question 1')
    })

    it('changes the answerArray label to a group of rows and columns', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const array = metadata.fields.textFieldId.answerArray

      for (let i = 0; i < array.length; i++) {
        const nestedArray = array[i]
        for (let j = 0; j < array.length; j++) {
          expect(nestedArray[j].label).toEqual(
            `Response 1, Row ${i + 1} Column ${j + 1}`,
          )
        }
      }
    })
  })
})
