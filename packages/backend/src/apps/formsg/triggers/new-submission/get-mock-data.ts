import { IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { customAlphabet } from 'nanoid/async'

import { COMMON_S3_MOCK_FOLDER_PREFIX } from '@/helpers/s3'

import { filterNric } from '../../auth/decrypt-form-response'
import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type FormField = {
  _id: string
  columns?: Array<{
    _id: string
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
    case 'SGID':
    case 'SGID_MyInfo':
      return {
        verifiedSubmitterInfo: {
          sgidUinFin: filteredNric,
        },
      }
    case 'SP':
    case 'MyInfo':
      return {
        verifiedSubmitterInfo: {
          uinFin: filteredNric,
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
      $.http.get(`/v3/forms/${formId}/sample-submission`),
      $.http.get(`/v3/forms/${formId}`),
    ])

    const formFields = formDetails.form.form_fields as Array<FormField>
    for (let i = 0; i < formFields.length; i++) {
      if (data.responses[formFields[i]._id]) {
        // forcefully include all checkbox options in the correct order
        if (data.responses[formFields[i]._id].fieldType === 'checkbox') {
          data.responses[formFields[i]._id].answerArray =
            formFields[i].fieldOptions
          // include the others option if available
          if (formFields[i].othersRadioButton) {
            data.responses[formFields[i]._id].answerArray.push(
              'Others: Sample Input',
            )
          }
        }

        if (data.responses[formFields[i]._id].fieldType === 'address') {
          data.responses[formFields[i]._id].answerArray =
            generateMockAddressData()
        }

        if (data.responses[formFields[i]._id].fieldType === 'attachment') {
          data.responses[formFields[i]._id].answer = MOCK_ATTACHMENT_FILE_PATH
        }

        if (data.responses[formFields[i]._id].fieldType === 'nric') {
          data.responses[formFields[i]._id].answer = filterNric(
            $,
            data.responses[formFields[i]._id].answer,
          )
        }

        if (data.responses[formFields[i]._id].fieldType === 'email') {
          data.responses[formFields[i]._id].answer = $.user.email
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
