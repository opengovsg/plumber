import {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
  IGlobalVariable,
  IJSONObject,
} from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ADDRESS_LABELS } from '../../common/constants'
import trigger from '../../triggers/new-submission'

const pushTriggerItemMock = vi.fn()
const getLastExecutionStepMock = vi.fn()

const mocks = vi.hoisted(() => ({
  getMockData: vi.fn(),
  getFormDetailsFromGlobalVariable: vi.fn(),
}))

vi.mock('../../triggers/new-submission/get-mock-data', () => ({
  default: mocks.getMockData,
}))

vi.mock('../../common/webhook-settings', () => ({
  getFormDetailsFromGlobalVariable: mocks.getFormDetailsFromGlobalVariable,
}))

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
          headerFieldId: {
            question: 'Section Header',
            fieldType: 'section',
            order: 2,
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

  describe('testRun', () => {
    const $ = {
      auth: { data: { formId: '123' } },
      user: { email: 'test@test.com' },
      pushTriggerItem: pushTriggerItemMock,
      getLastExecutionStep: getLastExecutionStepMock,
    } as unknown as IGlobalVariable

    const mockData = {
      formId: '123',
      responses: {
        mockTextFieldId: {
          question: 'What is your name?',
          answer: 'herp derp',
        },
      },
    }

    const actualData = {
      formId: '123',
      submissionTime: '2025-06-17T14:25:14.195+08:00',
      responses: {
        textFieldId: {
          question: 'What is your age?',
          answer: 10,
        },
      },
    }

    beforeEach(() => {
      mocks.getMockData.mockResolvedValue(mockData)
      mocks.getFormDetailsFromGlobalVariable.mockReturnValue({
        formId: '123',
      })
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    it('should use mock data if preferMock is true and there is no past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue(null)
      await trigger.testRun($, { preferMock: true })
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: mockData,
        meta: {
          internalId: '',
          isMock: true,
          lastTestSubmissionDate: undefined,
        },
      })
    })

    it('should use mock data if preferMock is true even though there is past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue({
        dataOut: actualData,
        createdAt: '2025-06-16 07:06:30.155+00',
      })
      await trigger.testRun($, { preferMock: true })
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: mockData,
        meta: {
          internalId: '',
          isMock: true,
          lastTestSubmissionDate: new Date(
            '2025-06-17T14:25:14.195+08:00',
          ).toISOString(),
        },
      })
    })

    it('should use mock data if testRunMetadata is undefined and there is no past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue(null)
      await trigger.testRun($, undefined)
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: mockData,
        meta: {
          internalId: '',
          isMock: true,
          lastTestSubmissionDate: undefined,
        },
      })
    })

    it('should use last test submission if testRunMetadata is undefined and there is past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue({
        dataOut: actualData,
        createdAt: '2025-06-16 07:06:30.155+00',
      })
      await trigger.testRun($, undefined)
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: actualData,
        meta: {
          internalId: '',
          isMock: false,
          lastTestSubmissionDate: new Date(
            '2025-06-17T14:25:14.195+08:00',
          ).toISOString(),
        },
      })
    })

    it('should use last test submission if preferMock is false and there is past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue({
        dataOut: actualData,
        createdAt: '2025-06-16 07:06:30.155+00',
      })
      await trigger.testRun($, { preferMock: false })
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: actualData,
        meta: {
          internalId: '',
          isMock: false,
          lastTestSubmissionDate: new Date(
            '2025-06-17T14:25:14.195+08:00',
          ).toISOString(),
        },
      })
    })

    it('should use mock data if preferMock is false and there is no past submission', async () => {
      getLastExecutionStepMock.mockResolvedValue(null)
      await trigger.testRun($, { preferMock: false })
      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: mockData,
        meta: {
          internalId: '',
          isMock: true,
          lastTestSubmissionDate: undefined,
        },
      })
    })

    it('should store the createdAt time if submissionTime is not available', async () => {
      getLastExecutionStepMock.mockResolvedValue({
        dataOut: { ...actualData, submissionTime: undefined },
        createdAt: '2025-06-16 07:06:30.155+00',
      })
      await trigger.testRun($, { preferMock: false })

      expect(pushTriggerItemMock).toHaveBeenCalledWith({
        raw: { ...actualData, submissionTime: undefined },
        meta: {
          internalId: '',
          isMock: false,
          lastTestSubmissionDate: new Date(
            '2025-06-16 07:06:30.155+00',
          ).toISOString(),
        },
      })
    })
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

    it('changes the answer label to "1. What is your name?"', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.answer.label).toEqual(
        '1. What is your name?',
      )
    })

    it('positions the answer after the question', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId.question.order).toBeLessThan(
        metadata.fields.textFieldId.answer.order,
      )
    })

    it('should computes order for questions and answers even if order is not provided', async () => {
      const fields = executionStep.dataOut.fields as IJSONObject
      delete fields.textFieldId
      // generate a few fields
      for (let i = 0; i < 10; i++) {
        fields[`textFieldId${i + 1}`] = {
          question: `What is your name? ${i}`,
          answer: 'herp derp',
          fieldType: 'textField',
          order: i < 5 ? i + 1 : null,
        }
      }

      const metadata = await trigger.getDataOutMetadata(executionStep)

      expect(metadata.fields.textFieldId1.question.order).toBe(1)
      expect(metadata.fields.textFieldId1.answer.order).toBe(1.1)
      expect(metadata.fields.textFieldId2.question.order).toBe(2)
      expect(metadata.fields.textFieldId2.answer.order).toBe(2.1)
      expect(metadata.fields.textFieldId5.question.order).toBe(5)
      expect(metadata.fields.textFieldId5.answer.order).toBe(5.1)
      expect(metadata.fields.textFieldId6.question.order).toBe(6)
      expect(metadata.fields.textFieldId6.answer.order).toBe(6.1)
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

    it('collapses header fields', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(
        metadata.fields.headerFieldId.question.isCollapsedByDefault,
      ).toEqual(true)
    })

    it('collapses question variables', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      expect(metadata.fields.textFieldId.question.isCollapsedByDefault).toEqual(
        true,
      )
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
            question:
              'What are your hobbies? When do you do them? (activity, time)',
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
          addressFieldComplete: {
            question: 'What is your address?',
            fieldType: 'address',
            order: 4,
            answerArray: [
              '51',
              'BRAS BASAH ROAD',
              'Lazada One',
              '#08-888',
              '189554',
            ],
          },
          addressFieldPartial: {
            question: 'What is your address?',
            fieldType: 'address',
            order: 5,
            answerArray: ['51', 'BRAS BASAH ROAD', '', '', '189554'], // Some empty fields
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
        label: '1. Have you had your meals?',
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
          expect(nestedArray[j].label).toBe(
            `2. Row ${i + 1} ${
              j === 0 ? 'activity' : 'time'
            } - What are your hobbies? When do you do them?`,
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

    it('Address type: includes all address fields', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const addressMetadata = metadata.fields.addressFieldComplete
        .answerArray as IDataOutMetadatum[]

      expect(addressMetadata).toHaveLength(5)
      ADDRESS_LABELS.forEach((label, index) => {
        expect(addressMetadata[index].label).toEqual(
          `4.${index + 1}. ${label} - What is your address?`,
        )
      })
    })

    it('Address type: includes all metadata for empty address fields', async () => {
      const metadata = await trigger.getDataOutMetadata(executionStep)
      const addressMetadata = metadata.fields.addressFieldPartial
        .answerArray as IDataOutMetadatum[]
      ADDRESS_LABELS.forEach((label, index) => {
        expect(addressMetadata[index].label).toEqual(
          `5.${index + 1}. ${label} - What is your address?`,
        )
      })
    })
  })
})
