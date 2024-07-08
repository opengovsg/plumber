import type { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'

import { FORM_ID_LENGTH } from './constants'
import parseFormIdAsUrl from './parse-form-id-as-url'

const STAGING_SDK = formsgSdk({
  mode: 'staging',
})
const PRODUCTION_SDK = formsgSdk({
  mode: 'production',
})

// TODO: add UAT env
export const SUPPORTED_FORM_ENVS = ['prod', 'staging'] as const
export type FormEnv = (typeof SUPPORTED_FORM_ENVS)[number]

function isSupportedFormEnv(rawEnv: string): rawEnv is FormEnv {
  // Widen type to satisfy typescript
  const envs: readonly string[] = SUPPORTED_FORM_ENVS
  return envs.includes(rawEnv)
}

export function parseFormEnv($: IGlobalVariable): FormEnv {
  const { formId } = $.auth.data

  if (!formId || typeof formId !== 'string') {
    throw new Error('Provide a valid FormSG URL')
  }

  if (formId.length < FORM_ID_LENGTH) {
    throw new Error('The FormSG URL is invalid')
  }

  if (formId.length > FORM_ID_LENGTH) {
    const url = parseFormIdAsUrl(formId)
    if (!url) {
      throw new Error('The FormSG URL is invalid')
    }

    if (url.hostname === 'form.gov.sg' || url.hostname === 'form.gov.sg') {
      return 'prod'
    }

    const env = url.hostname.split('.')[0]
    if (isSupportedFormEnv(env)) {
      return env
    }
    throw new Error(`The ${env} FormSG environment is not supported yet.`)
  }

  // If we are here, then formId is the actual form ID itself without a url.
  // For legacy reasons, we assume that it's prod.
  return 'prod'
}

export function getSdk(env: FormEnv): ReturnType<typeof formsgSdk> {
  if (env === 'prod') {
    return PRODUCTION_SDK
  }
  return STAGING_SDK
}

export function getApiBaseUrl(env: FormEnv): string {
  if (env === 'prod') {
    return `https://form.gov.sg/api`
  }
  return `https://${env}.form.gov.sg/api`
}
