import {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
  IJSONArray,
  IJSONObject,
  IJSONValue,
} from '@plumber/types'

import logger from '@/helpers/logger'
import { parseS3Id } from '@/helpers/s3'

function buildQuestionMetadatum(fieldData: IJSONObject): IDataOutMetadatum {
  const question: IDataOutMetadatum = {
    type: 'text',
    label: fieldData.order ? `Question ${fieldData.order}` : null,
    order: fieldData.order ? (fieldData.order as number) : null,
  }

  if (fieldData.fieldType === 'attachment') {
    question['isHidden'] = true
  }

  return question
}

function buildAnswerMetadatum(fieldData: IJSONObject): IDataOutMetadatum {
  const answer: IDataOutMetadatum = {
    label: fieldData.order ? `Response ${fieldData.order}` : null,
    order: fieldData.order ? (fieldData.order as number) + 0.1 : null,
  }

  switch (fieldData.fieldType) {
    case 'attachment':
      answer['type'] = 'file'
      // We encode the question as the label because we hide the actual question
      // as a variable.
      answer['label'] = fieldData.question as string
      // For attachments, answer is one of:
      // 1. An S3 ID (if we stored the attachment into S3).
      // 2. An empty string (if attachment field is optional).
      // 3. A filename (uncommon - only for legacy forms with attachment fields
      //    in existing pipes).
      answer['displayedValue'] =
        parseS3Id(fieldData.answer as string)?.objectName ??
        (fieldData.answer as string)
      break
    default:
      answer['type'] = 'text'
      answer['label'] = fieldData.order ? `Response ${fieldData.order}` : null
  }

  return answer
}

function isAnswerArrayValid(fieldData: IJSONObject): boolean {
  if (!fieldData.answerArray) {
    return false
  }
  // strict check for only table and checkbox variables
  return fieldData.fieldType === 'table' || fieldData.fieldType === 'checkbox'
}

function buildAnswerArrayForCheckbox(
  fieldData: IJSONObject,
): IDataOutMetadatum[] {
  const answerArray = [] as IDataOutMetadatum[]
  const array = fieldData.answerArray as IJSONArray
  for (let i = 0; i < array.length; i++) {
    answerArray.push({
      type: 'text',
      label: fieldData.order
        ? `Response ${fieldData.order}, Selected Option ${i + 1}`
        : null,
      order: fieldData.order ? (fieldData.order as number) : null,
    })
  }
  return answerArray
}

function buildAnswerArrayForTable(
  fieldData: IJSONObject,
): IDataOutMetadatum[][] {
  const answerArray = [] as IDataOutMetadatum[][]
  const array = fieldData.answerArray as IJSONArray
  for (let i = 0; i < array.length; i++) {
    const option = array[i]
    const nestedAnswerArray = [] as IDataOutMetadatum[]
    const optionArray = option as IJSONArray
    for (let j = 0; j < optionArray.length; j++) {
      nestedAnswerArray.push({
        type: 'text',
        label: fieldData.order
          ? `Response ${fieldData.order}, Row ${i + 1} Column ${j + 1}`
          : null,
        order: fieldData.order ? (fieldData.order as number) : null,
      })
    }
    answerArray.push(nestedAnswerArray)
  }
  return answerArray
}

function buildAnswerArrayMetadatum(
  fieldData: IJSONObject,
  stepId: string,
  submissionId: IJSONValue,
): IDataOutMetadatum[] | IDataOutMetadatum[][] {
  // there should only be checkbox and table fieldtypes that contain answer array
  const fieldType = fieldData.fieldType
  switch (fieldType) {
    case 'checkbox':
      return buildAnswerArrayForCheckbox(fieldData)
    case 'table':
      return buildAnswerArrayForTable(fieldData)
    default:
      logger.warn(`Answer array unknown fieldtype: ${fieldType}`, {
        fieldType,
        stepId,
        submissionId,
      })
      return []
  }
}

function buildVerifiedSubmitterInfoMetadata(
  data: IJSONObject,
): IDataOutMetadata | null {
  if (!data.verifiedSubmitterInfo) {
    return null
  }

  const metadata: IDataOutMetadata = Object.create(null)

  for (const key of Object.keys(data.verifiedSubmitterInfo)) {
    switch (key) {
      case 'uinFin':
        metadata.uinFin = { label: 'NRIC/FIN (Verified)' }
        break
      case 'sgidUinFin':
        metadata.sgidUinFin = { label: 'NRIC/FIN (Verified)' }
        break
      case 'cpUid':
        metadata.cpUid = { label: 'CorpPass UID (Verified)' }
        break
      case 'cpUen':
        metadata.cpUen = { label: 'CorpPass UEN (Verified)' }
        break
    }
  }

  return metadata
}

function buildPaymentContentMetadata(
  data: IJSONObject,
): IDataOutMetadata | null {
  if (!data.paymentContent || Object.keys(data.paymentContent).length === 0) {
    return null
  }

  // Note: not all fields are guaranteed to be available in dataOut, but we can
  // still return metadata for the missing fields to keep code simple - they'll
  // just not be picked up by the front end.

  return {
    type: {
      label: 'FormSG Payments - Type',
    },
    status: {
      label: 'FormSG Payments - Status',
    },
    payer: {
      label: 'FormSG Payments - Payer Name',
    },
    url: {
      label: 'FormSG Payments - URL',
    },
    paymentIntent: {
      label: 'FormSG Payments - Payment Intent',
    },
    amount: {
      label: 'FormSG Payments - Amount',
    },
    productService: {
      type: 'text',
      label: 'FormSG Payments - Product Service',
    },
    dateTime: {
      label: 'FormSG Payments - Payment Time',
    },
    transactionFee: {
      label: 'FormSG Payments - Transaction Fee',
    },
  }
}

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = executionStep.dataOut
  if (!data || !data.fields) {
    return null
  }

  const fieldMetadata: IDataOutMetadata = Object.create(null)
  for (const [fieldId, fieldData] of Object.entries(data.fields)) {
    fieldMetadata[fieldId] = {
      question: buildQuestionMetadatum(fieldData),
      answer: buildAnswerMetadatum(fieldData),
      fieldType: { isHidden: true },
      order: { isHidden: true },
      myInfo: { attr: { isHidden: true } },
    }
    if (isAnswerArrayValid(fieldData)) {
      fieldMetadata[fieldId].answerArray = buildAnswerArrayMetadatum(
        fieldData,
        executionStep.stepId,
        data.submissionId,
      )
    }
  }

  const verifiedSubmitterInfo = buildVerifiedSubmitterInfoMetadata(data)
  const paymentContent = buildPaymentContentMetadata(data)

  const result: IDataOutMetadata = {
    fields: fieldMetadata,
    submissionId: {
      type: 'text',
      label: 'Submission ID',
    },
    submissionTime: {
      type: 'text',
      label: 'Submission Time',
    },
  }
  if (verifiedSubmitterInfo) {
    result.verifiedSubmitterInfo = verifiedSubmitterInfo
  }
  if (paymentContent) {
    result.paymentContent = paymentContent
  }

  return result
}

export default getDataOutMetadata

// Reference dataOut with myInfo fields
// ---
// {
//   fields: {
//     647edbd2026dc800116b21f9: {
//       answer: 'zzz',
//       question: 'What is the air speed velocity of an unladen swallow?',
//       fieldType: 'textfield',
//       order: 2,
//     },
//     648fe18a9175ce001196b3d5: {
//       answer: 'aaaa',
//       question: 'What is your name?',
//       fieldType: 'textfield',
//       order: 1,
//     },
//     649d3183c4c52f00124ceb16: {
//       question: 'Attach your sparrow velocity readings.',
//       answer: 's3:common-bucket:649306c1ac8851001149af0a/649d3183c4c52f00124ceb16/my readings.txt',
//       fieldType: 'attachment',
//       order: 3,
//     },
//     655c766835b8460012ed7475: {
//       answer: 'Male',
//       question: '[MyInfo] Gender',
//       fieldType: 'dropdown',
//       order: 4,
//       myInfo: {
//         attr: 'sex',
//       }
//     },
//   },
//   # verifiedSubmitterInfo may not exist!
//   verifiedSubmitterInfo: {
//     uinFin: 'S1234567B',
//     sgidUinFin: 'S1234567A',
//     cpUid: 'U987654323PLUMBER',
//     cpUen: 'S7654321Z',
//   },
//   # paymentContent will be an empty object for forms without payments.
//   paymentContent: {
//     type: 'payment_charge',
//     status: 'succeeded',
//     payer: 'ken@open.gov.sg',
//     url: 'https://form.gov.sg/api/v3/payments/abcde/12345/invoice/download',
//     paymentIntent: 'pi_3OfIXUC0kzPzcBpr1WOcsRKD',
//     amount: '1.00',
//     productService: '1 x 1',
//     dateTime: '2024-02-02T08:56:08.000Z',
//     transactionFee: '0.54'
//   },
//   submissionId: '649306c1ac8851001149af0a',
//   submissionTime: '2023-07-06T18:26:27.505+08:00'
// }
