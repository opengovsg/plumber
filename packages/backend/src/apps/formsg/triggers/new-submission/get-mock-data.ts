import { IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { customAlphabet } from 'nanoid/async'

import { COMMON_S3_BUCKET } from '@/helpers/s3'

import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type FormField = {
  _id: string
  columns?: Array<{
    _id: string
  }>
}

const MOCK_ATTACHMENT_FILE_PATH = `s3:${COMMON_S3_BUCKET}:submission_id/form_field_id/Logo.jpg`
// const MOCK_ATTACHMENT_FILE_PATH = `s3:${COMMON_S3_BUCKET}:Logo.jpg`

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
        if (data.responses[formFields[i]._id].question === 'Attachment') {
          data.responses[formFields[i]._id].answer = MOCK_ATTACHMENT_FILE_PATH
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
    }
  } catch (e) {
    throw new Error(
      'Unable to fetch form fields. Form might be deleted or not public.',
    )
  }
}

export default getMockData
