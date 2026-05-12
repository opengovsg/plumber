import { IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { customAlphabet } from 'nanoid/async'

import logger from '@/helpers/logger'
import { COMMON_S3_MOCK_FOLDER_PREFIX } from '@/helpers/s3'

import { filterNric } from '../../auth/decrypt-form-response'
import convertTableAnswerArrayToTableObject from '../../common/process-table-field'
import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type ChildSubfield =
  | 'childname'
  | 'childbirthcertno'
  | 'childdateofbirth'
  | 'childgender'
  | 'childvaxxstatus'
  | 'childrace'
  | 'childsecondaryrace'

type ChildSubfieldDetails = {
  displayLabel: string
  mockData: string
  isMyInfoFieldLabel: boolean
}

type FormField = {
  _id: string
  columns?: Array<{
    _id: string
    title?: string
  }>
  fieldType: string
  fieldOptions?: string[]
  othersRadioButton?: boolean
  childrenSubFields?: ChildSubfield[]
  myInfo?: { attr: string }
}

// Naming of MyInfo child subfields from https://github.com/opengovsg/FormSG/blob/develop/packages/shared/constants/field/myinfo/index.ts
const myInfoChildSubfieldMap: Record<ChildSubfield, ChildSubfieldDetails> = {
  childname: {
    displayLabel: 'Name',
    mockData: 'Jackson Kim',
    isMyInfoFieldLabel: true,
  },
  childbirthcertno: {
    displayLabel: 'Birth certificate number',
    mockData: 'T0700001J',
    isMyInfoFieldLabel: true,
  },
  childdateofbirth: {
    displayLabel: 'Date of birth',
    mockData: '23/01/2007', // MyInfo provides child DOB as DD/MM/YYYY...
    isMyInfoFieldLabel: true,
  },
  childgender: {
    displayLabel: 'Sex',
    mockData: 'MALE',
    isMyInfoFieldLabel: true,
  },
  childvaxxstatus: {
    displayLabel: 'Vaccination status',
    mockData:
      'MINIMUM VACCINATION REQUIREMENT FOR PRESCHOOL ADMISSION FULFILLED',
    isMyInfoFieldLabel: true,
  },
  childrace: {
    displayLabel: 'Race',
    mockData: 'CHINESE',
    isMyInfoFieldLabel: true,
  },
  childsecondaryrace: {
    displayLabel: 'Secondary race',
    mockData: 'OTHERS',
    isMyInfoFieldLabel: false,
  },
}

const myInfoSampleResponses: Record<string, string> = {
  regadd: '411 CHUA CHU KANG AVE 3, #12-3, SINGAPORE 238823',
  name: 'PHUA CHU KANG',
  passportnumber: 'E1234567X',
  vehno: 'SHA1234X',
  employment: 'PCK PTE LTD',
  marriagecertno: '123456789012345',
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

/**
 * Example of how a children subfield response would look in prod
 * childrenbirthrecords_<childrecordFieldID>_childname_0: {
 *  question: 'Child 1 Name',
 *  answer: 'Jackson',
 *  fieldType: 'children',
 *  order: '6.1'
 * }
 */

function generateMockChildrenSubfieldResponses(
  formField: FormField,
  order: number,
  childrenObjectIndex: number,
): Record<string, Record<string, string | number>> {
  const responses: Record<string, Record<string, string | number>> = {}
  const childrenSubFields = formField.childrenSubFields ?? []

  for (let j = 0; j < childrenSubFields.length; j++) {
    const subfieldName = childrenSubFields[j]
    const subfieldId = `${formField.myInfo?.attr}_${formField._id}_${subfieldName}_0`
    const subfieldDetails = myInfoChildSubfieldMap[subfieldName]

    responses[subfieldId] = {
      question: `${
        subfieldDetails.isMyInfoFieldLabel ? '[MyInfo]' : ''
      } Child ${childrenObjectIndex + 1} ${subfieldDetails.displayLabel}`,
      answer: subfieldDetails.mockData,
      fieldType: 'children',
      order: `${order}.${j + 1}`,
    }
  }

  return responses
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

function patchMockData(
  mockData: Record<string, any>,
  formDetails: Record<string, any>,
  $: IGlobalVariable,
) {
  const formFields = formDetails.form.form_fields as Array<FormField>

  const isMrf = formDetails.form.responseMode === 'multirespondent'

  // for myinfo children fields
  const newChildrenSubfieldResponses = Object.create(null)
  let childrenObjectIndex = 0 // to support the rare case of multiple child records form fields similar to how FormSG does it

  for (let i = 0; i < formFields.length; i++) {
    if (mockData.responses[formFields[i]._id]) {
      // forcefully include all checkbox options in the correct order
      if (mockData.responses[formFields[i]._id].fieldType === 'checkbox') {
        mockData.responses[formFields[i]._id].answerArray =
          formFields[i].fieldOptions
        // include the others option if available
        if (formFields[i].othersRadioButton) {
          mockData.responses[formFields[i]._id].answerArray.push(
            'Others: Sample Input',
          )
        }
      }

      // formsg payload doesnt contain this anyways, so we dont return in mock data
      // in mrf forms only, sections are also not returned in the payload
      if (
        mockData.responses[formFields[i]._id].fieldType === 'statement' ||
        mockData.responses[formFields[i]._id].fieldType === 'image' ||
        (isMrf && mockData.responses[formFields[i]._id].fieldType === 'section')
      ) {
        delete mockData.responses[formFields[i]._id]
        continue
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'address') {
        mockData.responses[formFields[i]._id].answerArray =
          generateMockAddressData()
      }

      // myInfo fields that do not have a proper sample response
      const myInfoAttr = formFields[i].myInfo?.attr
      if (myInfoAttr && myInfoAttr in myInfoSampleResponses) {
        mockData.responses[formFields[i]._id].answer =
          myInfoSampleResponses[myInfoAttr]
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'children') {
        const childrenField = formFields[i]

        // Generate new subfield responses with proper IDs for mapping
        const childrenResponses = generateMockChildrenSubfieldResponses(
          childrenField,
          i + 1,
          childrenObjectIndex,
        )
        Object.assign(newChildrenSubfieldResponses, childrenResponses)
        childrenObjectIndex += 1
        delete mockData.responses[formFields[i]._id] // remove the child records object after since it is giving a null from FormSG mock data
        continue
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'attachment') {
        mockData.responses[formFields[i]._id].answer = MOCK_ATTACHMENT_FILE_PATH
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'nric') {
        mockData.responses[formFields[i]._id].answer = filterNric(
          $,
          mockData.responses[formFields[i]._id].answer,
        )
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'email') {
        mockData.responses[formFields[i]._id].answer = $.user.email
      }

      // add a stringified version of the table data to the mock data
      if (mockData.responses[formFields[i]._id].fieldType === 'table') {
        const answerArray = mockData.responses[formFields[i]._id]
          .answerArray as string[][]
        const question = `${
          mockData.responses[formFields[i]._id].question
        } (${formFields[i].columns
          ?.map((column, index) => column?.title ?? `Col ${index + 1}`)
          .join(', ')})`

        mockData.responses[formFields[i]._id].question = question
        mockData.responses[formFields[i]._id].answer =
          convertTableAnswerArrayToTableObject(question, answerArray)
      }

      // These are not returned by the API, so we need to add them manually
      if (
        mockData.responses[formFields[i]._id].fieldType === 'country_region'
      ) {
        mockData.responses[formFields[i]._id].answer = 'SINGAPORE'
      }

      if (mockData.responses[formFields[i]._id].fieldType === 'signature') {
        mockData.responses[formFields[i]._id].answer = 'Signature captured'
      }

      mockData.responses[formFields[i]._id].order = i + 1
      mockData.responses[formFields[i]._id].id = undefined
    }
  }

  // Add children subfield responses with proper IDs for mapping
  Object.assign(mockData.responses, newChildrenSubfieldResponses)

  // There's actually no need to return since it's modifying in place
  return mockData
}

async function getMockData(
  $: IGlobalVariable,
  formSchema: Record<string, any>,
) {
  const { formId } = getFormDetailsFromGlobalVariable($)
  try {
    const { data } = await $.http.get('/v3/forms/:formId/sample-submission', {
      urlPathParams: {
        formId,
      },
    })

    // generate bson-objectid using nanoid to avoid extra dependency
    const hexAlphabets = '0123456789abcdef'
    const idLength = 24
    const generateIdAsync = customAlphabet(hexAlphabets, idLength)

    // this modifies (in-place) some of the values that formsg provides
    patchMockData(data, formSchema, $)

    return {
      fields: data.responses,
      submissionId: await generateIdAsync(),
      submissionTime: DateTime.now().toISO(),
      formId,
      ...(formSchema.form.isSubmitterIdCollectionEnabled &&
        generateVerifiedSubmitterInfoData(formSchema.form.authType, $)),
      ...(formSchema.form.payments_field?.enabled &&
        generateMockPaymentData(formSchema.form.payments_field.products)),
    }
  } catch (e) {
    logger.error('Mock data generation error', {
      error: e,
      formId: formId,
    })
    throw new Error(
      'Unable to generate mock form data. Please make an actual submission to proceed.',
    )
  }
}

export default getMockData
