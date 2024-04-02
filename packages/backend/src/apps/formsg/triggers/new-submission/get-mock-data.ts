import { IGlobalVariable } from '@plumber/types'

import ObjectID from 'bson-objectid'
import { DateTime } from 'luxon'

import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

async function getMockData($: IGlobalVariable) {
  try {
    const { formId } = getFormDetailsFromGlobalVariable($)
    const { data } = await $.http.get(`/v3/forms/${formId}/sample-submission`)

    return {
      fields: data.responses,
      submissionId: ObjectID().toHexString(),
      submissionTime: DateTime.now().toISO(),
    }
  } catch (e) {
    throw new Error(
      'Unable to fetch form fields. Form might be deleted or not public.',
    )
  }
}

export default getMockData
