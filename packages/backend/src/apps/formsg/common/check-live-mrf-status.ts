import axios from 'axios'

import { FormEnv, getApiBaseUrl } from './form-env'

const REQUEST_TIMEOUT_MS = 10_000

interface PublicFormResponse {
  form?: {
    responseMode?: string
    workflow?: unknown[]
  }
}

/**
 * Live-checks FormSG's public schema for a form's *current* MRF status.
 * `responseMode === 'multirespondent'` alone isn't enough — a form can be
 * left in that mode with no workflow ever configured, which every other MRF
 * check in this codebase (get-form-schema.ts, the newSubmission trigger's own
 * testRun) treats as a single-respondent form.
 *
 * Returns `null` — not `false` — on a missing form or fetch error, so
 * callers can tell "confirmed not MRF" apart from "couldn't check" and fail
 * safe (i.e. don't act on an unconfirmed result).
 */
export async function checkLiveMrfStatus(
  formId: string,
  env: FormEnv,
): Promise<boolean | null> {
  try {
    const { data } = await axios.get<PublicFormResponse>(
      `${getApiBaseUrl(env)}/v3/forms/${formId}`,
      { timeout: REQUEST_TIMEOUT_MS },
    )
    const form = data?.form
    if (!form) {
      return null
    }
    return (
      form.responseMode === 'multirespondent' &&
      (form.workflow?.length ?? 0) > 0
    )
  } catch {
    return null
  }
}
