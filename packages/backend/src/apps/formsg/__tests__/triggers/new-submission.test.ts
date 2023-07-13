import { IDataOutMetadatum, IExecutionStep, IJSONObject } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import trigger from '../../triggers/new-submission'

describe('new submission trigger', () => {
  let executionStep: IExecutionStep

  beforeEach(() => {
    executionStep = {
      dataOut: {
        fields: {
          textFieldId: {
            question: 'What is your name?',
            answer: 'herp derp',
            fieldType: 'textField',
            order: 1,
          },
        },
      },
    } as unknown as IExecutionStep
  })

  describe('dataOut metadata', () => {
    it('ensures that only question and answer props are visible', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      for (const [propName, data] of Object.entries(
        metadata.fields.textFieldId,
      )) {
        if (['question', 'answer'].includes(propName)) {
          expect((data as IDataOutMetadatum).isHidden).toBeUndefined()
        } else {
          expect((data as IDataOutMetadatum).isHidden).toEqual(true)
        }
      }
    })

    it('changes the question label to "Question #n"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.label).toEqual('Question 1')
    })

    it('changes the answer label to "Response #n"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.answer.label).toEqual('Response 1')
    })

    it('positions the answer after the question', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.order).toBeLessThan(
        metadata.fields.textFieldId.answer.order,
      )
    })

    it('sets label and order to null if question number is undefined', async () => {
      const fields = executionStep.dataOut.fields as IJSONObject
      fields.textFieldId = {
        question: 'What is your name?',
        answer: 'herp derp',
        fieldType: 'textField',
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.order).toBeNull()
      expect(metadata.fields.textFieldId.answer.order).toBeNull()
      expect(metadata.fields.textFieldId.question.label).toBeNull()
      expect(metadata.fields.textFieldId.answer.label).toBeNull()
    })
  })
})
