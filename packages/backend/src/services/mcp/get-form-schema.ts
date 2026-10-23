import type { FormEnv } from '@/apps/formsg/common/form-env'
import { getMrfStepName } from '@/apps/formsg/common/get-mrf-step-name'
import { mrfWorkflowDataSchema } from '@/apps/formsg/common/types'

import { fetchPublicForm, type PublicFormField } from './fetch-public-form'

const MAX_OPTIONS = 10

// Fields that never produce a wireable answer.
const NON_WIREABLE_FIELD_TYPES = new Set([
  'section',
  'statement',
  'image',
  'children', // MyInfo child records
])

// Fields whose answer arrives as `answerArray` instead of `answer` — see
// process-v3-responses.ts / process-v4-responses.ts.
const ANSWER_ARRAY_FIELD_TYPES = new Set([
  'checkbox',
  'table',
  'address',
  'signature',
])

export interface McpFormField {
  id: string
  title: string
  fieldType: string
  required: boolean
  answerType: 'answer' | 'answerArray'
  variablePath: string
  options?: string[]
  /** Number of options omitted when the list is longer than MAX_OPTIONS. */
  optionsTruncated?: number
  columns?: Array<{ id: string; title: string }>
  myInfoAttr?: string
}

export interface McpMrfStage {
  name: string
  isApproval: boolean
  /** Id of the field holding the approve/reject answer. Set when isApproval. */
  approvalFieldId?: string
  /** Ids of the form fields this stage fills in. */
  fieldIds: string[]
}

export interface McpFormSchema {
  formId: string
  env: FormEnv
  title: string
  isStorageMode: boolean
  isMrf: boolean
  /** Workflow stages in order. Only present for MRF forms. */
  mrfStages?: McpMrfStage[]
  fields: McpFormField[]
  warnings: string[]
}

export type McpFormSchemaResult = McpFormSchema | { error: string }

function toMcpFormField(field: PublicFormField): McpFormField {
  const answerType = ANSWER_ARRAY_FIELD_TYPES.has(field.fieldType)
    ? 'answerArray'
    : 'answer'

  const result: McpFormField = {
    id: field._id,
    title: field.title,
    fieldType: field.fieldType,
    required: field.required ?? false,
    answerType,
    variablePath: `fields.${field._id}.${answerType}`,
  }

  if (field.fieldOptions?.length) {
    result.options = field.fieldOptions.slice(0, MAX_OPTIONS)
    if (field.fieldOptions.length > MAX_OPTIONS) {
      result.optionsTruncated = field.fieldOptions.length - MAX_OPTIONS
    }
  }

  if (field.columns?.length) {
    result.columns = field.columns.map((c) => ({ id: c._id, title: c.title }))
  }

  if (field.myInfo?.attr) {
    result.myInfoAttr = field.myInfo.attr
  }

  return result
}

/**
 * Returns the PUBLIC schema of a FormSG form, shaped for the AI Builder. No
 * connection or secret key is involved. Errors are returned as data
 * ({ error }), never thrown, so the LLM can relay them.
 */
export async function getFormSchemaService(
  formUrlOrId: string,
): Promise<McpFormSchemaResult> {
  const result = await fetchPublicForm(formUrlOrId)
  if ('error' in result) {
    return result
  }
  const { formId, env, form } = result

  const isStorageMode = Boolean(form.publicKey)
  // A form can be left in 'multirespondent' responseMode without ever having
  // its workflow set up — Plumber (and the FormSG trigger's own MRF check,
  // see triggers/new-submission/index.ts) treats that as a single-respondent
  // form, not an MRF.
  const isMrf =
    form.responseMode === 'multirespondent' && (form.workflow?.length ?? 0) > 0

  const warnings: string[] = []
  if (!isStorageMode) {
    warnings.push(
      'This form is not a storage mode form, so it cannot be connected to Plumber.',
    )
  }
  let mrfStages: McpMrfStage[] | undefined
  if (isMrf) {
    const workflow = mrfWorkflowDataSchema.safeParse(form.workflow)
    if (workflow.success) {
      mrfStages = workflow.data.map((stage, index) => ({
        name: getMrfStepName(stage.step_name, index),
        isApproval: Boolean(stage.approval_field),
        ...(stage.approval_field && { approvalFieldId: stage.approval_field }),
        fieldIds: stage.edit,
      }))
      warnings.push(
        'This is a multi-respondent (MRF) form. mrfStages lists its workflow stages in order. Pass the form URL to create_pipe as form_url and Plumber creates one step per stage after the trigger.',
      )
    } else {
      warnings.push(
        "This is a multi-respondent (MRF) form, but its workflow stages could not be read. Don't assume which stages need approval.",
      )
    }
  }

  const fields = (form.form_fields ?? [])
    .filter((f) => !NON_WIREABLE_FIELD_TYPES.has(f.fieldType))
    .map(toMcpFormField)

  return {
    formId,
    env,
    title: form.title,
    isStorageMode,
    isMrf,
    ...(mrfStages && { mrfStages }),
    fields,
    warnings,
  }
}
