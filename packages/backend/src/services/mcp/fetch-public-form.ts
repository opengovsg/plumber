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

// Raw shape of the public GET /v3/forms/{id} response. Only what we read.
export interface PublicFormField {
  _id: string
  title: string
  fieldType: string
  required?: boolean
  fieldOptions?: string[]
  columns?: Array<{ _id: string; title: string }>
  myInfo?: { attr?: string }
}

export interface PublicForm {
  _id: string
  title: string
  responseMode: string
  workflow?: unknown[]
  publicKey?: string
  form_fields?: PublicFormField[]
}

export type FetchPublicFormResult =
  | { formId: string; env: FormEnv; form: PublicForm }
  | { error: string }

/**
 * Fetches the PUBLIC schema of a FormSG form. No connection or secret key is
 * involved. Errors are returned as data, never thrown, so the LLM can relay
 * them.
 *
 * SSRF-safe: the raw input is only ever parsed into a validated 24-hex-char
 * form ID and a known environment. The fetched URL is built against the
 * matching *.form.gov.sg API base, and the user string is never fetched
 * directly.
 */
export async function fetchPublicForm(
  formUrlOrId: string,
): Promise<FetchPublicFormResult> {
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

  let response: { form?: PublicForm }
  try {
    const { data } = await axios.get<{ form?: PublicForm }>(
      `${getApiBaseUrl(env)}/v3/forms/${formId}`,
      { timeout: REQUEST_TIMEOUT_MS },
    )
    response = data
  } catch (e) {
    logger.warn('fetchPublicForm: error fetching public form schema', {
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

  return { formId, env, form }
}
