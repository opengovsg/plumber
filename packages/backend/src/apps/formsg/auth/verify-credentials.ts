import { IGlobalVariable } from '@plumber/types'

import get from 'lodash.get'

import { FORM_ID_LENGTH } from '../common/constants'
import {
  FormEnv,
  getSdk,
  parseFormEnv,
  parseFormIdAsUrl,
} from '../common/form-env'

// ref: https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export const verifyFormCreds = async (
  $: IGlobalVariable,
  formId: string,
  secretKey: string,
  env: FormEnv,
) => {
  let formTitle = ''
  let publicKey = ''
  let responseMode = ''
  try {
    const { data } = await $.http.get(`/v3/forms/${formId}`)
    formTitle = get(data, 'form.title')
    publicKey = get(data, 'form.publicKey')
    responseMode = get(data, 'form.responseMode')
  } catch (error) {
    if (error.response?.status === 404) {
      if (error.response.data?.isPageFound) {
        // form is valid but not public
        throw new Error('Ensure form is public')
      }
    }
    throw new Error('Form not found')
  }

  if (responseMode === 'multirespondent') {
    throw new Error(
      'Multi-Respondent Forms cannot be connected to Plumber yet.',
    )
  }

  if (!formTitle) {
    throw new Error('Form does not exist')
  }

  if (!publicKey) {
    throw new Error('Form is not a storage mode form')
  }

  const formsgSdk = getSdk(env)
  if (!formsgSdk.crypto.valid(publicKey, secretKey)) {
    throw new Error('Invalid secret key')
  }

  // Prefix label with "[$env]" for non-prod environments
  const prefix = env !== 'prod' ? `[${env.toUpperCase()}] ` : ''
  await $.auth.set({
    screenName: `${prefix}${formId} - ${formTitle}`,
  })
}

export const parseSecretKeyFormat = ($: IGlobalVariable): string => {
  if (
    !BASE64_REGEX.test($.auth.data?.privateKey as string) ||
    Buffer.from($.auth.data?.privateKey as string, 'base64').length !== 32
  ) {
    throw new Error('Invalid secret key format')
  }
  return $.auth.data.privateKey as string
}

export const parseFormIdFormat = ($: IGlobalVariable): string => {
  if (!$.auth.data?.formId || typeof $.auth.data.formId !== 'string') {
    throw new Error('No form id provided')
  }

  let formId = $.auth.data.formId

  if (formId.length < FORM_ID_LENGTH) {
    throw new Error('Invalid form id')
  }

  // Extract form id (24 characters) from form url or form admin url
  // Example: https://form.gov.sg/<FORMID>
  // Example: https://form.gov.sg/admin/form/<FORMID>
  if (formId.length > FORM_ID_LENGTH) {
    if (!parseFormIdAsUrl(formId)) {
      throw new Error('Invalid form url')
    }

    // remove trailing slash if any
    formId = formId.replace(/\/$/, '')
    // extract last 24 characters
    formId = formId.slice(-FORM_ID_LENGTH)
  }

  return formId
}

const verifyCredentials = async ($: IGlobalVariable) => {
  const secretKey = parseSecretKeyFormat($)
  const formId = parseFormIdFormat($)
  const env = parseFormEnv($)
  await verifyFormCreds($, formId, secretKey, env)
}

export default verifyCredentials
