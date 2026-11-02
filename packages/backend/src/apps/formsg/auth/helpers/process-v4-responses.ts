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
import { type FormSchemaField, mrfWorkflowDataSchema } from '../../common/types'
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

function fieldIdsThroughStep(
  workflow: Array<{ edit: string[] }>,
  workflowStep: number,
): Set<string> {
  const reachedSteps = workflow.slice(0, Math.max(workflowStep, 0) + 1)
  return new Set(reachedSteps.flatMap((step) => step.edit))
}

function readSubmissionWorkflow(
  $: IGlobalVariable,
  formId: string,
): { workflow: Array<{ edit: string[] }>; workflowStep: number } | null {
  const workflowContent = $.request?.body?.data?.workflowContent
  if (!workflowContent) {
    return null
  }
  const parsed = mrfWorkflowDataSchema.safeParse(workflowContent.workflow)
  if (!parsed.success) {
    // Without this log, a new FormSG workflow shape stops MRF restoration silently.
    logger.warn('Unable to parse FormSG MRF workflow', {
      event: 'formsg-mrf-workflow-unparsable',
      formId,
      issues: parsed.error.issues,
    })
    return null
  }
  if (parsed.data.length === 0) {
    return null
  }
  const workflowStep = workflowContent.workflowStep
  return {
    workflow: parsed.data,
    workflowStep: typeof workflowStep === 'number' ? workflowStep : 0,
  }
}

/**
 * Puts back optional fields that v4 left out of the payload, in schema order.
 * Pipes expect those variables to exist.
 *
 * `restorableIds` limits an MRF delivery to fields reached by its step.
 * Null means every answer field in the schema.
 */
function withOmittedFields(
  responses: FieldResponsesV4,
  schemaFields: FormSchemaField[],
  restorableIds: Set<string> | null,
): FieldResponsesV4 {
  if (schemaFields.length === 0) {
    return responses
  }

  const answerFields = schemaFields.filter(
    (field) => !NON_ANSWER_FIELD_TYPES.has(field.fieldType),
  )
  const answerIds = new Set(answerFields.map((field) => field._id))
  const schemaIds = new Set(schemaFields.map((field) => field._id))

  // v1 and v3 keep payload order. So a field missing from the schema stays
  // after the answer field it followed in the payload.
  const unlistedAfter = new Map<string | null, string[]>()
  let previousId: string | null = null
  for (const id of Object.keys(responses)) {
    if (answerIds.has(id)) {
      previousId = id
    } else if (!schemaIds.has(id)) {
      unlistedAfter.set(previousId, [
        ...(unlistedAfter.get(previousId) ?? []),
        id,
      ])
    }
  }

  const ordered = new Map<string, FieldResponseV4>()
  for (const field of answerFields) {
    const response = responses[field._id]
    if (response || !restorableIds || restorableIds.has(field._id)) {
      ordered.set(field._id, response ?? makeEmptyResponse(field))
    }
    for (const id of unlistedAfter.get(field._id) ?? []) {
      ordered.set(id, responses[id])
    }
  }
  for (const id of unlistedAfter.get(null) ?? []) {
    ordered.set(id, responses[id])
  }
  return Object.fromEntries(ordered)
}

export async function processResponsesV4(
  $: IGlobalVariable,
  formId: string,
  responses: FieldResponsesV4,
): Promise<FormField[]> {
  const formSchemaFields: Record<string, FormSchemaField> = {}
  let schemaFieldList: FormSchemaField[] = []
  let restorableIds: Set<string> | null = null
  try {
    const formSchema = await fetchFormSchema($, formId)
    if (formSchema?.form?.form_fields) {
      schemaFieldList = formSchema.form.form_fields
      const schemaWorkflow = formSchema.form.workflow ?? []
      // No workflow means the form is single-respondent, even in that mode.
      const configuredMrf =
        formSchema.form.responseMode === 'multirespondent' &&
        schemaWorkflow.length > 0
      if (configuredMrf) {
        const submissionWorkflow = readSubmissionWorkflow($, formId)
        restorableIds = submissionWorkflow
          ? fieldIdsThroughStep(
              submissionWorkflow.workflow,
              submissionWorkflow.workflowStep,
            )
          : new Set()
      }
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
    restorableIds,
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
