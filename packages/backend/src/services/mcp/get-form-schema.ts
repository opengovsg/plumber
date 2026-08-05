import axios from 'axios'

import { parseFormIdFromInput } from '@/apps/formsg/auth/verify-credentials'
import {
  FormEnv,
  getApiBaseUrl,
  parseFormEnvFromInput,
} from '@/apps/formsg/common/form-env'
import logger from '@/helpers/logger'

const FORM_ID_REGEX = /^[a-f0-9]{24}$/i

const REQUEST_TIMEOUT_MS = 10_000

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

export interface McpFormSchema {
  formId: string
  env: FormEnv
  title: string
  isStorageMode: boolean
  isMrf: boolean
  fields: McpFormField[]
  warnings: string[]
}

export type McpFormSchemaResult = McpFormSchema | { error: string }

// Raw shape of the public GET /v3/forms/{id} response — only what we read.
interface PublicFormField {
  _id: string
  title: string
  fieldType: string
  required?: boolean
  fieldOptions?: string[]
  columns?: Array<{ _id: string; title: string }>
  myInfo?: { attr?: string }
}

interface PublicFormResponse {
  form?: {
    _id: string
    title: string
    responseMode: string
    publicKey?: string
    form_fields?: PublicFormField[]
  }
}

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
 * Fetches the PUBLIC schema of a FormSG form — no connection or secret key
 * involved. Errors are returned as data ({ error }), never thrown, so the
 * LLM can relay them.
 *
 * SSRF-safe: the raw input is only ever parsed into a validated 24-hex-char
 * form ID and a known environment; the fetched URL is constructed against
 * the corresponding *.form.gov.sg API base and the user string is never
 * fetched directly.
 */
export async function getFormSchemaService(
  formUrlOrId: string,
): Promise<McpFormSchemaResult> {
  let formId: string
  let env: FormEnv
  try {
    const trimmed = formUrlOrId.trim()
    formId = parseFormIdFromInput(trimmed)
    env = parseFormEnvFromInput(trimmed)
  } catch (e) {
    return { error: (e as Error).message }
  }

  if (!FORM_ID_REGEX.test(formId)) {
    return { error: 'Invalid form id' }
  }

  let response: PublicFormResponse
  try {
    const { data } = await axios.get<PublicFormResponse>(
      `${getApiBaseUrl(env)}/v3/forms/${formId}`,
      { timeout: REQUEST_TIMEOUT_MS },
    )
    response = data
  } catch (e) {
    logger.warn('getFormSchemaService: error fetching public form schema', {
      formId,
      env,
      error: e.message,
    })
    if (e.response?.status === 404) {
      if (e.response.data?.isPageFound) {
        return {
          error:
            'This form is not public. Ask the user to make the form public and try again.',
        }
      }
      return { error: 'Form does not exist. Check the form URL.' }
    }
    return { error: 'Unable to fetch form. Try again later.' }
  }

  const form = response?.form
  if (!form?.title) {
    return { error: 'Unable to fetch form. Try again later.' }
  }

  const isStorageMode = Boolean(form.publicKey)
  const isMrf = form.responseMode === 'multirespondent'

  const warnings: string[] = []
  if (!isStorageMode) {
    warnings.push(
      'This form is not a storage mode form, so it cannot be connected to Plumber.',
    )
  }
  if (isMrf) {
    warnings.push(
      'This is a multi-respondent (MRF) form, which is not supported by Plumber.',
    )
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
    fields,
    warnings,
  }
}
