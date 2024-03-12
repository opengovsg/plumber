import { IGlobalVariable } from '@plumber/types'

import ObjectID from 'bson-objectid'
import { DateTime } from 'luxon'

import { getFormDetailsFromGlobalVariable } from '../../common/webhook-settings'

type FormField = {
  _id: string
  title: string
  fieldType: string
  fieldOptions?: Array<string>
  columns?: Array<{
    _id: string
    title: string
    columnType: 'textfield' | 'dropdown'
    fieldOptions?: Array<string>
  }>
}

function getSampleValue(field: FormField) {
  switch (field.fieldType) {
    case 'textarea':
    case 'textfield':
      return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
    case 'radiobutton':
    case 'dropdown':
      return field.fieldOptions[0]
    case 'checkbox':
      return [field.fieldOptions[0]]
    case 'country_region':
      return 'SINGAPORE'
    case 'date':
      return DateTime.now().toFormat('dd MMM yyyy')
    case 'table': {
      const sampleRow: Array<string> = field.columns.map(
        ({ columnType, fieldOptions, title, _id }) =>
          getSampleValue({
            _id,
            title,
            fieldType: columnType,
            fieldOptions: fieldOptions,
          }) as string,
      )
      return [sampleRow, sampleRow]
    }
    case 'email':
      return 'hello@example.com'
    case 'decimal':
      return 1.234 as number
    case 'number':
      return 1234 as number
    case 'mobile':
      return '+6598765432'
    case 'homeno':
      return '+6567890123'
    case 'yes_no':
      return 'Yes'
    case 'rating':
      return '1'
    default:
      return ''
  }
}

function getSampleAnswerKey(fieldType: string) {
  if (fieldType === 'checkbox') {
    return 'answerArray'
  }
  return 'answer'
}

async function getMockData($: IGlobalVariable) {
  try {
    const { formId } = getFormDetailsFromGlobalVariable($)
    const { data } = await $.http.get(`/v3/forms/${formId}`)
    const sampleData: Record<string, any> = {
      fields: {},
      submissionId: ObjectID().toHexString(),
      submissionTime: DateTime.now().toISO(),
    }
    const formFields = data?.form?.form_fields as Array<FormField>
    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i]
      sampleData.fields[field._id] = {
        order: i + 1,
        [getSampleAnswerKey(field.fieldType)]: getSampleValue(field),
        question: field.title,
        fieldType: field.fieldType,
      }
    }
    return sampleData
  } catch (e) {
    throw new Error(
      'Unable to fetch form fields. Form might be deleted or not public.',
    )
  }
}

export default getMockData
