import { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'
import get from 'lodash.get'

// ref: https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const FORM_ID_LENGTH = 24

export const verifyFormCreds = async (
  $: IGlobalVariable,
  formId: string,
  secretKey: string,
) => {
  let formTitle = ''
  let publicKey = ''
  try {
    const { data } = await $.http.get(`/v3/forms/${formId}`)
    formTitle = get(data, 'form.title')
    publicKey = get(data, 'form.publicKey')
  } catch (error) {
    if (error.response?.status === 404) {
      if (error.response.data?.isPageFound) {
        // form is valid but not public
        throw new Error('Ensure form is public')
      }
    }
    throw new Error('Form not found')
  }

  if (!formTitle) {
    throw new Error('Form does not exist')
  }

  if (!publicKey) {
    throw new Error('Form is not a storage mode form')
  }

  if (!formsgSdk().crypto.valid(publicKey, secretKey)) {
    throw new Error('Invalid secret key')
  }

  await $.auth.set({
    screenName: `${formId} - ${formTitle}`,
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
    if (
      !formId.startsWith('https://form.gov.sg/') &&
      !formId.startsWith('https://www.form.gov.sg/')
    ) {
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
  await verifyFormCreds($, formId, secretKey)
}

export default verifyCredentials
