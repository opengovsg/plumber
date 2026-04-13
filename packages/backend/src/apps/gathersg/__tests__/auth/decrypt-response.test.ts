import { describe, expect, it } from 'vitest'

import { HEX_ENCODED_FIELD_PREFIX } from '../../common/constants'
import { processFields } from '../../common/utils'

describe('processFields', () => {
  it('should process fields with whitespace, -, _', () => {
    const fields = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      'field-email': 'john.doe@example.com',
      field_email: 'john.doe@example.com',
      'field email': 'john.doe@example.com',
    }
    const processedFields = processFields(fields)
    expect(processedFields).toEqual(fields)
  })

  it.each([
    'field / Email',
    'field.email',
    'field&email',
    'field%email',
    'field$email',
    'field@email',
    'field^email',
    'field!email',
    'field(email)',
  ])('should hex encode fields with special characters', (field: string) => {
    const fields = {
      name: 'John Doe',
      [field]: 'john.doe@example.com',
    }
    const hexEncodedField = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(
      field,
    ).toString('hex')}`
    const processedFields = processFields(fields)
    expect(processedFields).toEqual({
      name: 'John Doe',
      [hexEncodedField]: 'john.doe@example.com',
    })
  })
})
