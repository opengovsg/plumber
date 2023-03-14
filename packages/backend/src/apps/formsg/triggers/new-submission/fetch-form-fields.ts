import { IGlobalVariable } from '@plumber/types'

function addToSampleData(
  sampleData: Record<string, unknown>,
  field: Record<string, string>,
) {
  let sampleValue = null
  switch (field.fieldType) {
    case 'textarea':
    case 'textfield':
      sampleValue =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      break
    case 'radio':
    case 'dropdown':
      sampleValue = field.fieldOptions[0]
      break
    case 'email':
      sampleValue = 'hello@example.com'
      break
    case 'decimal':
      sampleValue = 1.234
      break
    case 'number':
      sampleValue = 1234
      break
    case 'mobile':
      sampleValue = '+6598765432'
      break
    case 'homeno':
      sampleValue = '+6567890123'
      break
    case 'yes_no':
      sampleValue = 'yes'
      break
    case 'rating':
      sampleValue = 1
      break
    default:
      break
  }
  if (sampleValue != null) {
    sampleData[field._id] = {
      question: field.title,
      answer: sampleValue,
    }
  }
}

async function fetchFormFields($: IGlobalVariable) {
  try {
    const { data } = await $.http.get(`/v3/forms/${$.auth.data?.formId}`)
    const sampleData: Record<string, any> = {}
    const formFields = data?.form?.form_fields
    if (!formFields) {
      throw new Error('Unable to get form fields')
    }
    for (const field of data.form.form_fields) {
      addToSampleData(sampleData, field)
    }
    return sampleData
  } catch (e) {
    throw new Error(
      'Unable to fetch form fields. Form might be deleted or not public.',
    )
  }
}

export default fetchFormFields
