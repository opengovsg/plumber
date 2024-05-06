import { IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { customAlphabet } from 'nanoid/async'

import { COMMON_S3_BUCKET } from '@/helpers/s3'

import { filterNric } from '../../auth/decrypt-form-response'
import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type FormField = {
  _id: string
  columns?: Array<{
    _id: string
  }>
}

const MOCK_ATTACHMENT_FILE_PATH = `s3:${COMMON_S3_BUCKET}:mock/plumber-logo.jpg`
const MOCK_NRIC = 'S1234568B'

function generateVerifiedSubmitterInfoData(
  authType: string,
  $: IGlobalVariable,
): Record<string, Record<string, string>> {
  const filteredNric = filterNric($, MOCK_NRIC)
  switch (authType) {
    case 'SGID':
    case 'SGID_MyInfo':
      return {
        verifiedSubmitterInfo: {
          sgidUinFin: filteredNric,
        },
      }
    case 'SP':
    case 'MyInfo':
      return {
        verifiedSubmitterInfo: {
          uinFin: filteredNric,
        },
      }
  }
  return {}
}

async function getMockData($: IGlobalVariable) {
  try {
    const { formId } = getFormDetailsFromGlobalVariable($)

    const [{ data }, { data: formDetails }] = await Promise.all([
      $.http.get(`/v3/forms/${formId}/sample-submission`),
      $.http.get(`/v3/forms/${formId}`),
    ])

    const formFields = formDetails.form.form_fields as Array<FormField>
    for (let i = 0; i < formFields.length; i++) {
      if (data.responses[formFields[i]._id]) {
        if (data.responses[formFields[i]._id].fieldType === 'attachment') {
          data.responses[formFields[i]._id].answer = MOCK_ATTACHMENT_FILE_PATH
        }

        if (data.responses[formFields[i]._id].fieldType === 'nric') {
          data.responses[formFields[i]._id].answer = filterNric(
            $,
            data.responses[formFields[i]._id].answer,
          )
        }

        data.responses[formFields[i]._id].order = i + 1
        data.responses[formFields[i]._id].id = undefined
      }
    }

    // generate bson-objectid using nanoid to avoid extra dependency
    const hexAlphabets = '0123456789abcdef'
    const idLength = 24
    const generateIdAsync = customAlphabet(hexAlphabets, idLength)

    return {
      fields: data.responses,
      submissionId: await generateIdAsync(),
      submissionTime: DateTime.now().toISO(),
      formId,
      ...generateVerifiedSubmitterInfoData(formDetails.form.authType, $),
    }
  } catch (e) {
    throw new Error(
      'Unable to generate mock form data. Please make an actual submission to proceed.',
    )
  }
}

export default getMockData
