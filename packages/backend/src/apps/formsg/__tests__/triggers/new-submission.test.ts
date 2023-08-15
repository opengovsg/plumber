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
        verifiedSubmitterInfo: {
          uinFin: 'S1234567B',
          sgidUinFin: 'S1234567A',
          cpUid: 'U987654323PLUMBER',
          cpUen: 'S7654321Z',
        },
      },
    } as unknown as IExecutionStep
  })

  describe('dataOut metadata', () => {
    it('ensures that only question, answer and answerArray props are visible', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      for (const [propName, data] of Object.entries(
        metadata.fields.textFieldId,
      )) {
        if (['question', 'answer', 'answerArray'].includes(propName)) {
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

    it('sets a label for SingPass verified NRIC/FIN', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.verifiedSubmitterInfo.uinFin.label).toEqual(
        'NRIC/FIN (Verified)',
      )
    })

    it('sets a label for sgID verified NRIC/FIN', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.verifiedSubmitterInfo.sgidUinFin.label).toEqual(
        'NRIC/FIN (Verified)',
      )
    })

    it('sets a label for verified CorpPass UEN', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.verifiedSubmitterInfo.cpUen.label).toEqual(
        'CorpPass UEN (Verified)',
      )
    })

    it('sets a label for verified CorpPass UID', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.verifiedSubmitterInfo.cpUid.label).toEqual(
        'CorpPass UID (Verified)',
      )
    })

    it('sets a label for verified CorpPass UEN', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.verifiedSubmitterInfo.cpUen.label).toEqual(
        'CorpPass UEN (Verified)',
      )
    })

    it('sets type to file for attachment answers', async () => {
      executionStep.dataOut.fields = {
        fileFieldId: {
          question: 'Attach a file.',
          answer: 's3:bucket_name:abcd/efg/my file.txt',
          fieldType: 'attachment',
        },
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.fileFieldId.answer.type).toEqual('file')
    })

    it('sets displayed value for attachment answers', async () => {
      executionStep.dataOut.fields = {
        fileFieldId: {
          question: 'Attach a file.',
          answer: 's3:bucket_name:abcd/efg/my file.txt',
          fieldType: 'attachment',
        },
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.fileFieldId.answer.displayedValue).toEqual(
        'my file.txt',
      )
    })

    it('sets label to the associated question for attachment answers', async () => {
      executionStep.dataOut.fields = {
        fileFieldId: {
          question: 'Attach a file.',
          answer: 's3:bucket_name:abcd/efg/my file.txt',
          fieldType: 'attachment',
        },
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.fileFieldId.answer.label).toEqual('Attach a file.')
    })

    it('hides attachment questions', async () => {
      executionStep.dataOut.fields = {
        fileFieldId: {
          question: 'Attach a file.',
          answer: 's3:bucket_name:abcd/efg/my file.txt',
          fieldType: 'attachment',
        },
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.fileFieldId.question.isHidden).toEqual(true)
    })
  })
})

describe('new submission trigger for answer array fields', () => {
  let executionStep: IExecutionStep

  beforeEach(() => {
    executionStep = {
      dataOut: {
        fields: {
          textFieldId1: {
            question: 'Have you had your meals?',
            fieldType: 'checkbox',
            order: 1,
            answerArray: ['lunch', 'dinner'],
          },
          textFieldId2: {
            question: 'What are your hobbies? When do you do them?',
            fieldType: 'table',
            order: 2,
            answerArray: [
              ['sleeping', 'night'],
              ['eating', 'all day'],
            ],
          },
          textFieldId3: {
            question: 'Unknown question',
            fieldType: 'unknown',
            order: 3,
            answerArray: ['weird', 'strange'],
          },
        },
      },
    } as unknown as IExecutionStep
  })

  describe('dataOut metadata', () => {
    it('changes the question label to "Question 1"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId1.question.label).toEqual('Question 1')
    })

    it('Checkbox type: changes the answerArray label to a group of selected responses', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const array = metadata.fields.textFieldId1.answerArray

      for (let i = 0; i < array.length; i++) {
        expect(array[i].label).toEqual(`Response 1, Selected Option ${i + 1}`)
      }
    })

    it('changes the question label to "Question 2"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId2.question.label).toEqual('Question 2')
    })

    it('Table type: changes the answerArray label to a group of rows and columns', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const array = metadata.fields.textFieldId2.answerArray

      for (let i = 0; i < array.length; i++) {
        const nestedArray = array[i]
        for (let j = 0; j < array.length; j++) {
          expect(nestedArray[j].label).toEqual(
            `Response 2, Row ${i + 1} Column ${j + 1}`,
          )
        }
      }
    })

    it('changes the question label to "Question 3"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId3.question.label).toEqual('Question 3')
    })

    it('Unknown type: answerArray label should be undefined', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.textFieldId3.answerArray).toBeUndefined()
    })
  })
})
