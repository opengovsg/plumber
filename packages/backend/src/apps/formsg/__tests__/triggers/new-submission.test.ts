import {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
  IJSONObject,
} from '@plumber/types'

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
            myInfo: {
              attr: 'name',
            },
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
        // only myInfo contains IDataOutMetadata instead of IDataOutMetadatum
        if (propName === 'myInfo') {
          expect((data as IDataOutMetadata)['attr'].isHidden)
          continue
        }

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

    it('should handle null dataOut', async () => {
      executionStep.dataOut = null

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata).toEqual(null)
    })

    it('should handle undefined `dataOut.fields` property', async () => {
      executionStep.dataOut = {}

      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata).toEqual(null)
    })

    describe('formsg payments', () => {
      beforeEach(() => {
        executionStep.dataOut.paymentContent = {
          type: 'payment_charge',
          status: 'succeeded',
          payer: 'ken@open.gov.sg',
          url: 'https://form.gov.sg/api/v3/payments/abcde/12345/invoice/download',
          paymentIntent: 'pi_3OfIXUC0kzPzcBpr1WOcsRKD',
          amount: '1.00',
          productService: '1 x 1',
          dateTime: '2024-02-02T08:56:08.000Z',
          transactionFee: '0.54',
        }
      })

      it('should set labels for payment data', async () => {
        const metadata = await trigger.getDataOutMetadata(executionStep)

        expect(metadata).toHaveProperty('paymentContent')
        for (const key of Object.keys(executionStep.dataOut.paymentContent)) {
          expect(metadata.paymentContent).toHaveProperty(key)
          expect(metadata.paymentContent[key]).toHaveProperty('label')
          expect(typeof metadata.paymentContent[key].label).toBe('string')
          expect(metadata.paymentContent[key].label.length).toBeGreaterThan(0)
        }
      })

      it('should not error out even if some payment fields are not provided', async () => {
        delete (executionStep.dataOut.paymentContent as IJSONObject)
          .productService
        delete (executionStep.dataOut.paymentContent as IJSONObject).url

        const metadata = await trigger.getDataOutMetadata(executionStep)

        // Also check that metadata is still provided for the other fields.
        for (const key of Object.keys(executionStep.dataOut.paymentContent)) {
          expect(metadata.paymentContent[key].label.length).toBeGreaterThan(0)
        }
      })

      it('should not error out if new payment fields are added', async () => {
        const paymentContentObject = executionStep.dataOut
          .paymentContent as IJSONObject
        paymentContentObject.futureProp = 'sample data'

        const metadata = await trigger.getDataOutMetadata(executionStep)

        // Also check that metadata is still provided for the known fields
        for (const key of Object.keys(executionStep.dataOut.paymentContent)) {
          if (key === 'futureProp') {
            continue
          }
          expect(metadata.paymentContent[key].label.length).toBeGreaterThan(0)
        }
      })

      it('should not have payment metadata if there is no paymentContent in dataOut', async () => {
        delete (executionStep.dataOut as IJSONObject).paymentContent

        const metadata = await trigger.getDataOutMetadata(executionStep)
        expect(metadata).not.toHaveProperty('paymentContent')
      })
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

    it('Checkbox type: changes the answerArray label to a single response', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const array = metadata.fields.textFieldId1.answerArray
      // type will be array instead of text!
      expect(array).toEqual({
        type: 'array',
        label: 'Response 1',
        order: 1.1,
      })
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
