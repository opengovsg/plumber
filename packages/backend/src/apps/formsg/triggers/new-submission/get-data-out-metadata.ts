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

import { ADDRESS_LABELS } from '../../common/constants'

function buildQuestionMetadatum(fieldData: IJSONObject): IDataOutMetadatum {
  const question: IDataOutMetadatum = {
    type: 'text',
    label: fieldData.order ? `Question ${fieldData.order}` : null,
    order: fieldData.order ? (fieldData.order as number) : null,
    isCollapsedByDefault: true,
  }

  if (fieldData.fieldType === 'section') {
    question.label = 'Header'
  }

  if (fieldData.fieldType === 'attachment') {
    question['isHidden'] = true
  }

  return question
}

function buildAnswerMetadatum(fieldData: IJSONObject): IDataOutMetadatum {
  const answer: IDataOutMetadatum = {
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
    // Headers will only have empty answers
    case 'section':
      answer.isHidden = true
      break
    default:
      answer['type'] = 'text'
      answer['label'] = fieldData.order
        ? `${fieldData.order}. ${fieldData.question}`
        : null
  }

  return answer
}

function isAnswerArrayValid(fieldData: IJSONObject): boolean {
  if (!fieldData.answerArray) {
    return false
  }
  // strict check for only table, checkbox and address variables
  const answerArrayFields = ['table', 'checkbox', 'address']
  return answerArrayFields.includes(fieldData.fieldType as string)
}

function buildAnswerArrayForAddress(fieldData: IJSONObject): IDataOutMetadata {
  const { order, question } = fieldData

  // NOTE: we return all labels as there are some optional fields in FormSG
  // the label is shown before the question, since it will be truncated in the variable pill
  return ADDRESS_LABELS.map((label, index) => ({
    type: 'text',
    label: `${order}.${index + 1}. ${label} - ${question}`,
    order: order ? `${order}.${index + 1}` : null,
  }))
}

function buildAnswerArrayForCheckbox(
  fieldData: IJSONObject,
): IDataOutMetadatum {
  const { order, question } = fieldData
  // NOTE: checkbox answerArray will not be further splitted,
  // handled specifically in variables.ts and compute-parameters.ts
  return {
    type: 'array',
    label: `${order}. ${question}`,
    order: order ? (order as number) + 0.1 : null,
  }
}

function extractLastTopLevelBracketContent(questionText: string): {
  content: string
  prefix: string
} {
  let depth = 0
  let start = -1
  let lastValid = ''
  let prefix = ''

  for (let i = 0; i < questionText.length; i++) {
    if (questionText[i] === '(') {
      if (depth === 0) {
        start = i
        prefix = questionText.slice(0, i).trim()
      }
      depth++
    } else if (questionText[i] === ')') {
      depth--
      if (depth === 0 && start !== -1) {
        lastValid = questionText.slice(start + 1, i)
        start = -1 // reset
      }
    }
  }

  return {
    content: lastValid,
    prefix,
  }
}

function buildAnswerArrayForTable(
  fieldData: IJSONObject,
): IDataOutMetadatum[][] {
  const answerArray = [] as IDataOutMetadatum[][]
  const array = fieldData.answerArray as IJSONArray
  const { order, question } = fieldData
  // questions are give in this format:
  // Table Question (Column 1, Column 2, Column 3)
  // step 1: find the match open bracket for the last pair of brackets
  const { prefix: topLevelQuestion, content: columnNames } =
    extractLastTopLevelBracketContent(question as string)
  const columnNamesArray = columnNames.split(',').map((name) => name.trim())

  for (let i = 0; i < array.length; i++) {
    const option = array[i]
    const nestedAnswerArray = [] as IDataOutMetadatum[]
    const optionArray = option as IJSONArray
    for (let j = 0; j < optionArray.length; j++) {
      // If the column names contain commas, we can't simply split by comma
      // so we gotta just display the entire question name
      // Also, making an API call to forms to retrieve the column names takes too long
      // and won't work if the form is closed
      let label = `${order}. ${question} Row ${i + 1} Col ${j + 1}`
      if (columnNamesArray.length === optionArray.length) {
        label = `${order}. Row ${i + 1} ${
          columnNamesArray[j]
        } - ${topLevelQuestion}`
      }
      nestedAnswerArray.push({
        type: 'text',
        label,
        order: order ? (order as number) + 0.1 : null,
      })
    }
    answerArray.push(nestedAnswerArray)
  }
  return answerArray
}

function buildTableMetadatum(fieldData: IJSONObject): IDataOutMetadata {
  const tableObject = JSON.parse(fieldData.answer as string)
  return {
    label: `Response ${fieldData.order}`,
    order: fieldData.order ? (fieldData.order as number) + 0.1 : null,
    type: 'table',
    displayedValue: `Preview ${tableObject.rows.length} row(s)`,
    value: tableObject,
  }
}

function buildAnswerArrayMetadatum(
  fieldData: IJSONObject,
  stepId: string,
  submissionId: IJSONValue,
): IDataOutMetadatum | IDataOutMetadatum[][] {
  // there should only be checkbox and table fieldtypes that contain answer array
  const fieldType = fieldData.fieldType
  switch (fieldType) {
    case 'checkbox':
      return buildAnswerArrayForCheckbox(fieldData)
    case 'table':
      return buildAnswerArrayForTable(fieldData)
    case 'address':
      return buildAnswerArrayForAddress(fieldData)
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

  const fields = Object.entries(data.fields).sort((a, b) => {
    const orderA = a[1].order
    const orderB = b[1].order
    if (orderA === null) {
      return 1
    }
    return orderA - orderB
  })

  /**
   * This is a hack to match the question number to the form as closely as possible.
   * In formsg, the headers are not numbered, so we need to exclude them from the question number.
   * But we also need to keep track of the headers between questions, so we can order them correctly.
   * The regenerated order will be like so:
   * Example given form:
   * Header 0.9991
   * Header 0.9992
   * Question 1
   * Question 2
   * Sub Heading 2.9991
   * Question 3
   * Header 3.9991
   * Sub Heading 3.9992
   * Question 4
   * Sub Heading 4.9991
   * Question 4
   */
  let questionOrder = 0
  let headerOrderBetweenQuestions = 0
  for (const [fieldId, fieldData] of fields) {
    if (fieldData.fieldType !== 'section') {
      // reset order between questions (altho not necessary)
      headerOrderBetweenQuestions = 0
      questionOrder++
      fieldData.order = questionOrder
    } else {
      headerOrderBetweenQuestions++
      fieldData.order = questionOrder + +`0.999${headerOrderBetweenQuestions}`
    }
    fieldMetadata[fieldId] = {
      question: buildQuestionMetadatum(fieldData),
      answer: buildAnswerMetadatum(fieldData),
      fieldType: { isHidden: true },
      order: { isHidden: true },
      myInfo: { attr: { isHidden: true } },
      isVisible: { isHidden: true },
      isHeader: { isHidden: true },
    }
    if (isAnswerArrayValid(fieldData)) {
      // table field will have a stringified table object in the answer field
      // so that it can be used in for-each
      // this is also used to generate the table preview in the frontend
      if (fieldData.fieldType === 'table') {
        fieldMetadata[fieldId].answer = buildTableMetadatum(fieldData)
      }
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
    formId: {
      type: 'text',
      label: 'Form ID',
    },
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
