import { IGlobalVariable } from '@plumber/types'

// ref: https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const verifyFormExists = async ($: IGlobalVariable) => {
  let formTitle = ''
  try {
    const { data } = await $.http.get(`/v3/forms/${$.auth.data?.formId}`)
    formTitle = data.form.title
  } catch (error) {
    if (error.response?.status === 404) {
      if (error.response.data?.isPageFound) {
        // form is valid but not public
        formTitle = error.response.data.formTitle
      }
    }
  }
  if (!formTitle) {
    throw new Error('Form does not exist')
  }
  await $.auth.set({
    screenName: `${$.auth.data.formId} - ${formTitle}`,
  })
}

const verifySecretKeyFormat = ($: IGlobalVariable) => {
  if (!BASE64_REGEX.test($.auth.data?.privateKey as string)) {
    throw new Error('Invalid secret key format')
  }
}

const verifyCredentials = async ($: IGlobalVariable) => {
  await verifyFormExists($)
  verifySecretKeyFormat($)
}

export default verifyCredentials
