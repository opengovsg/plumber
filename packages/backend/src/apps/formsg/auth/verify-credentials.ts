import { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'
import get from 'lodash.get'

// ref: https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const verifyFormCreds = async ($: IGlobalVariable) => {
  if (!$.auth.data?.formId) {
    throw new Error('No form id provided')
  }
  let formTitle = ''
  let publicKey = ''
  try {
    const { data } = await $.http.get(`/v3/forms/${$.auth.data.formId}`)
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

  if (!formsgSdk().crypto.valid(publicKey, $.auth.data?.privateKey as string)) {
    throw new Error('Invalid secret key')
  }

  await $.auth.set({
    screenName: `${$.auth.data.formId} - ${formTitle}`,
  })
}

const verifySecretKeyFormat = ($: IGlobalVariable) => {
  if (
    !BASE64_REGEX.test($.auth.data?.privateKey as string) ||
    Buffer.from($.auth.data?.privateKey as string, 'base64').length !== 32
  ) {
    throw new Error('Invalid secret key format')
  }
}

const verifyCredentials = async ($: IGlobalVariable) => {
  verifySecretKeyFormat($)
  await verifyFormCreds($)
}

export default verifyCredentials
