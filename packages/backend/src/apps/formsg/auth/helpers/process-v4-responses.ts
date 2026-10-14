import type {
  AddressAnswerV4,
  AnswerV4,
  AttachmentAnswerV4,
  CheckboxAnswerV4,
  FieldResponsesV4,
  FieldResponseV4,
  FieldType,
  FormField,
  RadioAnswerV4,
  SignatureAnswerV4,
  StringAnswerV4,
  TableAnswerV4,
  VerifiableAnswerV4,
} from '@opengovsg/formsg-sdk'
import type { IGlobalVariable } from '@plumber/types'
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

// Mirrors ChildrenAnswerV4 in @opengovsg/formsg-sdk.
const keyedChildrenAnswerSchema = z.record(
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

// Mirrors ChildrenCompoundFieldResponsesV3 in FormSG. FormSG rolls out the
// keyed shape gradually, so v4 submissions can still carry this one.
const legacyChildrenAnswerSchema = z.object({
  child: z.array(z.array(z.string())),
  childFields: z.array(z.string()),
})

// One map of attr to value per child.
type ChildValues = Map<string, string>

function readKeyedChildren(
  fieldId: string,
  answer: z.infer<typeof keyedChildrenAnswerSchema>,
): ChildValues[] {
  return Object.values(answer).map((child) => {
    const values: ChildValues = new Map()
    for (const [key, subField] of Object.entries(child.value)) {
      // The object key is normally the attribute, but myInfo.attr is the
      // authoritative source.
      const attr = subField.myInfo?.attr ?? key
      if (values.has(attr)) {
        logger.warn('Duplicate FormSG children subfield', {
          event: 'formsg-duplicate-children-subfield',
          fieldId,
          attr,
        })
        continue
      }
      values.set(attr, subField.value)
    }
    // The SDK allows LOCAL or SPONSORED here instead of as a childtype
    // subfield, so read it rather than drop it.
    if (child.type && !values.has('childtype')) {
      values.set('childtype', child.type)
    }
    return values
  })
}

function readLegacyChildren(
  answer: z.infer<typeof legacyChildrenAnswerSchema>,
): ChildValues[] {
  return answer.child.map(
    (row) => new Map(answer.childFields.map((attr, i) => [attr, row[i] ?? ''])),
  )
}

function parseChildrenAnswer(fieldId: string, answer: unknown) {
  return z
    .union([
      keyedChildrenAnswerSchema.transform((keyed) =>
        readKeyedChildren(fieldId, keyed),
      ),
      legacyChildrenAnswerSchema.transform(readLegacyChildren),
    ])
    .safeParse(answer)
}

/**
 * FormSG nests every subfield under one `children` response, which pipe authors
 * cannot reference individually.
 *
 * @param firstChildNumber 0-based display number of this field's first child.
 */
function flattenChildrenAnswer(
  fieldId: string,
  valuesByChild: ChildValues[],
  schemaSubFields: string[],
  firstChildNumber: number,
): FormField[] {
  // Giving every child the same subfields keeps the variable list stable when
  // MyInfo omits a value for one child but not another.
  const attrs = [
    ...new Set([
      ...schemaSubFields,
      ...valuesByChild.flatMap((values) => [...values.keys()]),
    ]),
  ]

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

// v4 never sends these. They have no answer to restore.
const NON_ANSWER_FIELD_TYPES = new Set(['statement', 'image', 'section'])

const EMPTY_ANSWERS: Partial<Record<FieldType, AnswerV4>> = {
  checkbox: { value: [] },
  table: {},
  signature: { type: 'draw', value: [] },
  children: {},
  radiobutton: { value: '', isOthersInput: false },
  attachment: { value: '', hasBeenScanned: false },
  // Blank subfields must be '' so address variables do not become undefined.
  address: {
    postalCode: { value: '' },
    blockNumber: { value: '' },
    streetName: { value: '' },
    buildingName: { value: '' },
    levelNumber: { value: '' },
    unitNumber: { value: '' },
  },
}

function makeEmptyResponse(field: FormSchemaField): FieldResponseV4 {
  const fieldType = field.fieldType as FieldType
  return {
    fieldType,
    question: field.title,
    provenance: {},
    answer: EMPTY_ANSWERS[fieldType] ?? { value: '' },
  }
}

/**
 * Puts back optional fields that v4 left out of the payload.
 * Pipes expect those variables to exist.
 */
function withOmittedFields(
  responses: FieldResponsesV4,
  schemaFields: FormSchemaField[],
  isMultirespondent: boolean,
): FieldResponsesV4 {
  if (schemaFields.length === 0) {
    return responses
  }
  // Filling the full schema would expose fields outside the current MRF step.
  if (isMultirespondent) {
    return responses
  }

  const schemaFieldIds = new Set(schemaFields.map((field) => field._id))
  const answerSchemaIds = new Set(
    schemaFields
      .filter((field) => !NON_ANSWER_FIELD_TYPES.has(field.fieldType))
      .map((field) => field._id),
  )
  const unknownAfter = new Map<string, Array<[string, FieldResponseV4]>>()
  const trailingUnknown: Array<[string, FieldResponseV4]> = []
  let previousKnownId: string | null = null
  for (const [id, response] of Object.entries(responses)) {
    if (answerSchemaIds.has(id)) {
      previousKnownId = id
      continue
    }
    if (schemaFieldIds.has(id)) {
      continue
    }
    if (!previousKnownId) {
      trailingUnknown.push([id, response])
      continue
    }
    const pending = unknownAfter.get(previousKnownId) ?? []
    pending.push([id, response])
    unknownAfter.set(previousKnownId, pending)
  }

  const filled: FieldResponsesV4 = {}
  for (const field of schemaFields) {
    if (NON_ANSWER_FIELD_TYPES.has(field.fieldType)) {
      continue
    }
    filled[field._id] = responses[field._id] ?? makeEmptyResponse(field)
    for (const [id, response] of unknownAfter.get(field._id) ?? []) {
      filled[id] = response
    }
  }

  for (const [id, response] of trailingUnknown) {
    if (!schemaFieldIds.has(id)) {
      filled[id] = response
    }
  }
  return filled
}

export async function processResponsesV4(
  $: IGlobalVariable,
  formId: string,
  responses: FieldResponsesV4,
): Promise<FormField[]> {
  const formSchemaFields: Record<string, FormSchemaField> = {}
  let schemaFieldList: FormSchemaField[] = []
  let isMultirespondent = false
  try {
    const formSchema = await fetchFormSchema($, formId)
    if (formSchema?.form?.form_fields) {
      schemaFieldList = formSchema.form.form_fields
      isMultirespondent = formSchema.form.responseMode === 'multirespondent'
      for (const field of schemaFieldList) {
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
  // FormSG numbers children across the submission, not per children field.
  let childNumber = 0
  const responsesWithOmittedFields = withOmittedFields(
    responses,
    schemaFieldList,
    isMultirespondent,
  )
  for (const [key, value] of Object.entries(responsesWithOmittedFields)) {
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
      // Formatting an empty date string yields Invalid DateTime.
      if (!originalDateString) {
        mappedResponses.push({
          _id: key,
          fieldType: value.fieldType,
          question,
          answer: '',
        })
        continue
      }
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
      const parsed = parseChildrenAnswer(key, value.answer)
      if (!parsed.success) {
        // An unrecognised shape degrades to one empty variable, rather than
        // failing the whole submission.
        logger.error('Unable to parse FormSG children answer', {
          event: 'formsg-unparsable-children-answer',
          formId,
          fieldId: key,
          // IMPORTANT: the answer is child PII. Issues name paths and types
          // only, never values.
          issues: parsed.error.issues,
        })
        mappedResponses.push({
          _id: key,
          fieldType: value.fieldType,
          question,
          answer: '',
        })
        continue
      }

      const flattened = flattenChildrenAnswer(
        key,
        parsed.data,
        formSchemaFields[key]?.childrenSubFields ?? [],
        childNumber,
      )
      childNumber += parsed.data.length
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
