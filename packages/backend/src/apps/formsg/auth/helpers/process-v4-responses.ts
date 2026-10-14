import type { IGlobalVariable } from '@plumber/types'

import type {
  AddressAnswerV4,
  AttachmentAnswerV4,
  CheckboxAnswerV4,
  FieldResponsesV4,
  FormField,
  RadioAnswerV4,
  SignatureAnswerV4,
  StringAnswerV4,
  TableAnswerV4,
  VerifiableAnswerV4,
} from '@opengovsg/formsg-sdk'
import { DateTime } from 'luxon'
import { z } from 'zod'

import logger from '@/helpers/logger'

import {
  buildChildSubfieldKey,
  buildChildSubfieldQuestion,
} from '../../common/myinfo-child-subfields'
import type { FormSchemaField } from '../../common/types'
import { fetchFormSchema } from '../../triggers/new-submission/fetch-form-schema'

const CHECKBOX_OTHERS_MARKER = '!!FORMSG_INTERNAL_CHECKBOX_OTHERS_VALUE!!'

// Mirrors ChildrenAnswerV4 in @opengovsg/formsg-sdk. Parsed rather than cast
// because FormSG changed this shape once already.
const childrenAnswerSchema = z.record(
  z.string(),
  z.object({
    value: z.record(
      z.string(),
      z.object({
        value: z.string(),
        myInfo: z.object({ attr: z.string() }).optional(),
      }),
    ),
    type: z.string().optional(),
  }),
)

type ChildrenAnswer = z.infer<typeof childrenAnswerSchema>

/**
 * Flattens one MyInfo children answer into one variable per child subfield.
 *
 * FormSG nests every subfield under a single `children` response. Pipe authors
 * need to reference each subfield on its own, so each becomes its own variable.
 *
 * @param firstChildNumber 0-based display number of this field's first child.
 */
function flattenChildrenAnswer(
  fieldId: string,
  childrenAnswer: ChildrenAnswer,
  schemaSubFields: string[],
  firstChildNumber: number,
): FormField[] {
  const children = Object.values(childrenAnswer)

  // Keyed by attribute so a subfield is found regardless of its position.
  const valuesByChild = children.map((child) => {
    const values = new Map<string, string>()
    for (const [key, subField] of Object.entries(child.value)) {
      values.set(subField.myInfo?.attr ?? key, subField.value)
    }
    // LOCAL or SPONSORED arrives as a childtype subfield. The SDK also allows
    // it on the entry itself, so accept that rather than drop the value.
    if (child.type && !values.has('childtype')) {
      values.set('childtype', child.type)
    }
    return values
  })

  // Every child gets the same subfields, so the variable list stays stable when
  // MyInfo omits a value for one child but not another.
  const attrs = [...schemaSubFields]
  for (const values of valuesByChild) {
    for (const attr of values.keys()) {
      if (!attrs.includes(attr)) {
        attrs.push(attr)
      }
    }
  }

  const responses: FormField[] = []
  for (const [childIndex, values] of valuesByChild.entries()) {
    for (const attr of attrs) {
      responses.push({
        _id: buildChildSubfieldKey(fieldId, attr, childIndex),
        fieldType: 'children',
        question: buildChildSubfieldQuestion(
          attr,
          firstChildNumber + childIndex,
        ),
        answer: values.get(attr) ?? '',
      })
    }
  }

  return responses
}

export async function processResponsesV4(
  $: IGlobalVariable,
  formId: string,
  responses: FieldResponsesV4,
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
  // FormSG numbers children across the whole submission, not per children
  // field, in the rare case that a form has more than one.
  let childNumber = 0
  for (const [key, value] of Object.entries(responses)) {
    questionNumber++
    // we fallback to Question # if the question is not found in the form schema
    let question = formSchemaFields[key]?.title ?? `Question ${questionNumber}`
    if (value.fieldType === 'table') {
      const tableAnswer = value.answer as TableAnswerV4
      // v4 table answers are keyed by row id ({ rowId: { rowNum, value } });
      // map back to a matrix ordered by rowNum, like the v3 array of rows
      const answerArray = Object.values(tableAnswer)
        .sort((a, b) => a.rowNum - b.rowNum)
        .map((row) => Object.values(row.value).map(String))
      // we follow the same format as the old table field title schema
      if (formSchemaFields[key]?.columns) {
        question += ` (${formSchemaFields[key]?.columns
          ?.map((column) => column.title.replaceAll(',', ' '))
          .join(', ')})`
      }
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'checkbox') {
      const checkboxAnswer = value.answer as CheckboxAnswerV4
      const answerArray = checkboxAnswer.value.map((v) =>
        v === CHECKBOX_OTHERS_MARKER
          ? `Others: ${checkboxAnswer.othersInput}`
          : v,
      )
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'radiobutton') {
      const radioAnswer = value.answer as RadioAnswerV4
      // When "Others" is selected, isOthersInput is true and value holds the
      // free-text input
      const answer = radioAnswer.isOthersInput
        ? `Others: ${radioAnswer.value}`
        : radioAnswer.value
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answer,
      })
      continue
    }
    if (['email', 'mobile'].includes(value.fieldType)) {
      const answer = value.answer as VerifiableAnswerV4
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answer: answer.value,
        // preserve the OTP-verification signature for email fields so
        // downstream code can detect verified emails; formSG only ever
        // sets this for email, never mobile
        ...(value.fieldType === 'email' && answer.signature
          ? { signature: answer.signature }
          : {}),
      })
      continue
    }
    if (value.fieldType === 'signature') {
      const signatureAnswer = value.answer as SignatureAnswerV4
      // signature points are only length-checked downstream, never read
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answerArray: signatureAnswer.value as unknown as string[][],
      })
      continue
    }
    if (value.fieldType === 'address') {
      const addressAnswer = (value.answer ?? {}) as Partial<AddressAnswerV4>
      // we need to map to [block number, street name, building name, level number, unit number, postal code]
      const answerArray = [
        addressAnswer.blockNumber,
        addressAnswer.streetName,
        addressAnswer.buildingName,
        addressAnswer.levelNumber,
        addressAnswer.unitNumber,
        addressAnswer.postalCode,
      ].map((subField) => subField?.value) as string[]
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answerArray,
      })
      continue
    }
    if (value.fieldType === 'attachment') {
      const attachmentAnswer = value.answer as AttachmentAnswerV4
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        // we temporarily store the filename in answer, it will subsequently be replaced with the S3 ID from storeAttachmentInS3
        answer: attachmentAnswer.value,
      })
      continue
    }
    if (value.fieldType === 'date') {
      // Currently, v4 responses return the date as DD/MM/YYYY (e.g. 29/03/2026)
      // We need to convert it to the standard FormSG date format (e.g. 29 Mar 2026)
      const originalDateString = (value.answer as StringAnswerV4).value
      const originalDate = DateTime.fromFormat(originalDateString, 'dd/MM/yyyy')
      const convertedDateString = originalDate.toPlumberFormat('dd MMM yyyy')
      mappedResponses.push({
        _id: key,
        fieldType: value.fieldType,
        question,
        answer: convertedDateString,
      })
      continue
    }
    if (value.fieldType === 'children') {
      const parsed = childrenAnswerSchema.safeParse(value.answer)
      if (!parsed.success) {
        // Keep the submission flowing as one opaque variable. Only the issues
        // are logged, since the answer itself holds child PII.
        logger.error('Unable to parse FormSG children answer', {
          event: 'formsg-unparsable-children-answer',
          formId,
          fieldId: key,
          issues: parsed.error.issues,
        })
        mappedResponses.push({
          _id: key,
          fieldType: value.fieldType,
          question,
          answer: value.answer as unknown as string,
        })
        continue
      }

      const flattened = flattenChildrenAnswer(
        key,
        parsed.data,
        formSchemaFields[key]?.childrenSubFields ?? [],
        childNumber,
      )
      childNumber += Object.keys(parsed.data).length
      mappedResponses.push(...flattened)
      continue
    }
    // catch-all: generic string answers ({ value }) and any future field
    // types, e.g. yes_no, textfield, dropdown, nric
    mappedResponses.push({
      _id: key,
      fieldType: value.fieldType,
      question,
      answer: String((value.answer as StringAnswerV4).value),
    })
    continue
  }
  return mappedResponses
}
