import { IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { customAlphabet } from 'nanoid/async'

import { COMMON_S3_MOCK_FOLDER_PREFIX } from '@/helpers/s3'

import { filterNric } from '../../auth/decrypt-form-response'
import convertTableAnswerArrayToTableObject from '../../common/process-table-field'
import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type FormField = {
  _id: string
  columns?: Array<{
    _id: string
    title?: string
  }>
  fieldType: string
  fieldOptions?: string[]
  othersRadioButton?: boolean
}

// Adapted from https://github.com/opengovsg/FormSG/blob/82c5ba6fff7e9628b6c32449148e89c0224e9ff5/shared/types/form/form.ts#L96
type PaymentProduct = {
  _id: string
  name: string
  description: string
  multi_qty: boolean
  min_qty: number
  max_qty: number
  amount_cents: number
}

export const MOCK_ATTACHMENT_FILE_PATH = `${COMMON_S3_MOCK_FOLDER_PREFIX}plumber-logo.jpg`
const MOCK_NRIC = 'S1234568B'
const MOCK_UEN = '201612345A'

function generateVerifiedSubmitterInfoData(
  authType: string,
  $: IGlobalVariable,
): Record<string, Record<string, string>> {
  const filteredNric = filterNric($, MOCK_NRIC)
  switch (authType) {
    case 'SGID': // deprecated
    case 'SGID_MyInfo': // deprecated
    case 'SP': // deprecated
    case 'MyInfo':
      // for backwards compatibility with old forms that were created with sgID authType,
      // we need to return both uinFin and sgidUinFin
      return {
        verifiedSubmitterInfo: {
          uinFin: filteredNric,
          sgidUinFin: filteredNric,
        },
      }
    case 'CP':
      return {
        verifiedSubmitterInfo: {
          cpUid: filteredNric,
          cpUen: MOCK_UEN,
        },
      }
  }
  return {}
}

function generateMockAddressData(): string[] {
  return ['51', 'BRAS BASAH ROAD', 'Lazada One', '#08-888', '189554']
}

function generateMockPaymentData(products: Partial<PaymentProduct>[]) {
  // if there are no payment products, default to a mocked one
  const firstProduct: Partial<PaymentProduct> =
    products.length > 0
      ? products[0]
      : {
          name: 'Test Product',
          amount_cents: 123,
        }

  // Only the amount and product service is ideally obtainable based on their form data
  return {
    paymentContent: {
      type: 'payment_charge',
      status: 'succeeded',
      payer: 'payer@open.gov.sg',
      url: 'https://form.gov.sg/api/v3/payments/abcde/12345/invoice/download',
      paymentIntent: 'pi_12345',
      amount: (firstProduct.amount_cents / 100).toFixed(2),
      productService: firstProduct.name,
      dateTime: new Date().toISOString(),
      transactionFee: '0.05',
    },
  }
}

async function getMockData($: IGlobalVariable) {
  try {
    const { formId } = getFormDetailsFromGlobalVariable($)

    const [{ data }, { data: formDetails }] = await Promise.all([
      $.http.get('/v3/forms/:formId/sample-submission', {
        urlPathParams: {
          formId,
        },
      }),
      $.http.get('/v3/forms/:formId', {
        urlPathParams: {
          formId,
        },
      }),
    ])

    const formFields = formDetails.form.form_fields as Array<FormField>
    for (let i = 0; i < formFields.length; i++) {
      if (data.responses[formFields[i]._id]) {
        const fieldType = data.responses[formFields[i]._id].fieldType
        // forcefully include all checkbox options in the correct order
        if (fieldType === 'checkbox') {
          data.responses[formFields[i]._id].answerArray =
            formFields[i].fieldOptions
          // include the others option if available
          if (formFields[i].othersRadioButton) {
            data.responses[formFields[i]._id].answerArray.push(
              'Others: Sample Input',
            )
          }
        }

        if (fieldType === 'signature') {
          data.responses[formFields[i]._id].answer = 'Signature captured' // mock this to always be present regardless of whether the user has signed or not
        }

        // formsg payload doesnt contain this anyways, so we dont return in mock data
        if (fieldType === 'statement') {
          delete data.responses[formFields[i]._id]
          continue
        }

        if (fieldType === 'address') {
          data.responses[formFields[i]._id].answerArray =
            generateMockAddressData()
        }

        if (fieldType === 'attachment') {
          data.responses[formFields[i]._id].answer = MOCK_ATTACHMENT_FILE_PATH
        }

        if (fieldType === 'nric') {
          data.responses[formFields[i]._id].answer = filterNric(
            $,
            data.responses[formFields[i]._id].answer,
          )
        }

        if (fieldType === 'email') {
          data.responses[formFields[i]._id].answer = $.user.email
        }

        // add a stringified version of the table data to the mock data
        if (fieldType === 'table') {
          const answerArray = data.responses[formFields[i]._id]
            .answerArray as string[][]
          const question = `${
            data.responses[formFields[i]._id].question
          } (${formFields[i].columns
            ?.map((column, index) => column?.title ?? `Col ${index + 1}`)
            .join(', ')})`

          data.responses[formFields[i]._id].question = question
          data.responses[formFields[i]._id].answer =
            convertTableAnswerArrayToTableObject(question, answerArray)
        }

        if (fieldType === 'section' || fieldType === 'image') {
          data.responses[formFields[i]._id].answer = ''
        }

        data.responses[formFields[i]._id].order = i + 1
        data.responses[formFields[i]._id].id = undefined
      }
    }

    // generate bson-objectid using nanoid to avoid extra dependency
    const hexAlphabets = '0123456789abcdef'
    const idLength = 24
    const generateIdAsync = customAlphabet(hexAlphabets, idLength)

    return {
      fields: data.responses,
      submissionId: await generateIdAsync(),
      submissionTime: DateTime.now().toISO(),
      formId,
      ...(formDetails.form.isSubmitterIdCollectionEnabled &&
        generateVerifiedSubmitterInfoData(formDetails.form.authType, $)),
      ...(formDetails.form.payments_field.enabled &&
        generateMockPaymentData(formDetails.form.payments_field.products)),
    }
  } catch (e) {
    throw new Error(
      'Unable to generate mock form data. Please make an actual submission to proceed.',
    )
  }
}

export default getMockData
