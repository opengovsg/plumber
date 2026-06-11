import type { IGlobalVariable } from '@plumber/types'

import { FormField } from '@opengovsg/formsg-sdk/dist/types'
import { DateTime } from 'luxon'

import logger from '@/helpers/logger'

import type { FormSchemaField } from '../../common/types'
import { fetchFormSchema } from '../../triggers/new-submission/fetch-form-schema'

const CHECKBOX_OTHERS_MARKER = '!!FORMSG_INTERNAL_CHECKBOX_OTHERS_VALUE!!'

export async function processResponsesV3(
  $: IGlobalVariable,
  formId: string,
  responsesV3: Record<string, any>,
): Promise<FormField[]> {
  const formSchemaFields: Record<string, FormSchemaField> = {}
  try {
    const formSchema = await fetchFormSchema($, formId)
    if (formSchema?.form?.form_fields) {
      for (const field of formSchema.form.form_fields) {
        formSchemaFields[field._id] = field
      }
    }
  } catch (e) {
    logger.error('Unable to fetch form schema', {
      event: 'formsg-unable-to-fetch-form-schema',
      formId,
      error: e,
    })
  }
  const mappedResponses: FormField[] = []
  let questionNumber = 0

  for (const [key, value] of Object.entries(responsesV3)) {
    questionNumber++
    if (value.fieldType === 'table') {
      let question =
        formSchemaFields[key]?.title ?? `Question ${questionNumber}`
      const answerArray = value.answer.map((row: Record<string, string>) => {
        return Object.values(row)
      })
      // we follow the same format as the old table field title schema
      if (formSchemaFields[key]?.columns) {
        question += ` (${formSchemaFields[key]?.columns
          ?.map((column) => column.title.replaceAll(',', ' '))
          .join(', ')})`
      }
      // v3 return table answers in an array of objects (with key as column id )
      // we need to map it back to a matrix
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'checkbox') {
      const answerArray = (value.answer.value as string[]).map((v) =>
        v === CHECKBOX_OTHERS_MARKER
          ? `Others: ${value.answer.othersInput}`
          : v,
      )
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'radiobutton') {
      // When "Others" is selected, the SDK returns { othersInput: '...' } with no value field
      const answer =
        value.answer.othersInput != null
          ? `Others: ${value.answer.othersInput}`
          : value.answer.value
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        answer,
      })
      continue
    }
    /**
     * Similary, formv3 responses put these fields in value.answer.value
     */
    if (['email', 'mobile'].includes(value.fieldType)) {
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        answer: value.answer.value,
      })
      continue
    }
    if (value.fieldType === 'signature') {
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        // it comes in this form: { type: 'draw', value: [Array] } },
        answerArray: value.answer.value,
      })
      continue
    }
    if (value.fieldType === 'address') {
      //  answer: { addressSubFields: [Object] } },
      const addressSubFields = value.answer.addressSubFields ?? {}
      // we need to map to [block number, street name, building name, level number, unit number, postal code]
      const answerArray = [
        addressSubFields.blockNumber,
        addressSubFields.streetName,
        addressSubFields.buildingName,
        addressSubFields.levelNumber,
        addressSubFields.unitNumber,
        addressSubFields.postalCode,
      ]
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'attachment') {
      // the answer has the shape { hasBeenScanned: boolean, answer: string, md5Hash: string }
      // the answer is the filename
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        // we temporarily store the filename in answer, it will subsequently be replaced with the S3 ID from storeAttachmentInS3
        answer: value.answer.answer,
      })
      continue
    }
    if (value.fieldType === 'date') {
      // Currently, v3 responses return the date as DD/MM/YYYY (e.g. 29/03/2026)
      // We need to convert it to the standard FormSG date format (e.g. 29 Mar 2026)
      const originalDateString = value.answer
      const originalDate = DateTime.fromFormat(originalDateString, 'dd/MM/yyyy')
      const convertedDateString = originalDate.toPlumberFormat('dd MMM yyyy')
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        // we fallback to Question # if the question is not found in the form schema
        question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
        answer: convertedDateString,
      })
      continue
    }
    // catch-all
    mappedResponses.push({
      _id: key,
      fieldType: value.fieldType,
      // we fallback to Question # if the question is not found in the form schema
      question: formSchemaFields[key]?.title ?? `Question ${questionNumber}`,
      answer: value.answer,
    })
    continue
  }
  return mappedResponses
}
