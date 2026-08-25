import { assert, describe, expect, it } from 'vitest'

import { schema } from '@/apps/pair/actions/process-image/schema'

describe('process-image schema', () => {
  describe('image validation', () => {
    it('should accept valid image array with one item', () => {
      const result = schema.safeParse({
        image: ['s3-id-123'],
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.image[0] === 's3-id-123')
      assert(result.data.continueIfNoFile === false)
    })

    it('should reject empty image array', () => {
      const result = schema.safeParse({
        image: [],
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('An image must be selected')
      }
    })

    it('should reject a blank image value by default', () => {
      const result = schema.safeParse({
        image: [''],
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('An image must be selected')
      }
    })

    it('should reject empty image array when continueIfNoFile is false', () => {
      const result = schema.safeParse({
        image: [],
        continueIfNoFile: false,
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === false)
    })

    it('should accept empty image array when continueIfNoFile is true', () => {
      const result = schema.safeParse({
        image: [],
        continueIfNoFile: true,
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.continueIfNoFile === true)
      assert(result.data.image.length === 0)
    })

    it('should accept a blank image value when continueIfNoFile is true', () => {
      const result = schema.safeParse({
        image: [''],
        continueIfNoFile: true,
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === true)
    })

    it('should still accept a real image when continueIfNoFile is true', () => {
      const result = schema.safeParse({
        image: ['s3-id-123'],
        continueIfNoFile: true,
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.image[0] === 's3-id-123')
    })

    it('should reject multiple images', () => {
      const result = schema.safeParse({
        image: ['s3-id-123', 's3-id-456'],
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Only one image allowed')
      }
    })

    it('should require image field', () => {
      const result = schema.safeParse({
        responseFields: [
          {
            fieldName: 'signature',
            description: 'Check for signature',
          },
        ],
      })
      assert(result.success === false)
    })
  })

  describe('responseFields validation', () => {
    describe('fieldName validation', () => {
      it.each(['field1', 'fieldname', 'Field123', 'ABC123', 'fieldName'])(
        'should accept valid field names with alphanumeric only: %s',
        (fieldName) => {
          const result = schema.safeParse({
            image: ['s3-id-123'],
            responseFields: [
              {
                fieldName,
                description: 'test description',
              },
            ],
          })
          assert(result.success === true)
          // After transformation, no spaces
          assert(result.data.responseFields[0].fieldName === fieldName)
        },
      )

      it.each([
        { input: 'field name', expected: 'field_name' },
        { input: 'Signature present', expected: 'Signature_present' },
        { input: 'field  with  spaces', expected: 'field__with__spaces' },
        { input: 'has multiple   spaces', expected: 'has_multiple___spaces' },
      ])(
        'should transform spaces to underscores: $input -> $expected',
        ({ input, expected }) => {
          const result = schema.safeParse({
            image: ['s3-id-123'],
            responseFields: [
              {
                fieldName: input,
                description: 'test description',
              },
            ],
          })
          assert(result.success === true)
          assert(result.data.responseFields[0].fieldName === expected)
        },
      )

      it.each([
        'field_name',
        'field-name',
        'field@name',
        'field.name',
        'field#name',
        'field!name',
        'field$name',
      ])(
        'should reject field names with invalid characters: %s',
        (fieldName) => {
          const result = schema.safeParse({
            image: ['s3-id-123'],
            responseFields: [{ fieldName, description: 'test description' }],
          })
          assert(result.success === false)
        },
      )

      it('should reject empty field names', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: '',
              description: 'test description',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should reject field names longer than 64 characters', () => {
        const longName = 'a'.repeat(65)
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: longName,
              description: 'test description',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should accept field names exactly 64 characters long', () => {
        const maxName = 'a'.repeat(64)
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: maxName,
              description: 'test description',
            },
          ],
        })
        assert(result.success === true)
      })

      it('should not accept duplicate field names after transformation (case-insensitive)', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'Field Name',
              description: 'test description 1',
            },
            {
              fieldName: 'field name',
              description: 'test description 2',
            },
          ],
        })
        assert(result.success === false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Output names must be unique (case-insensitive)',
          )
        }
      })

      it('should detect duplicates after space-to-underscore transformation', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field name',
              description: 'test description 1',
            },
            {
              fieldName: 'Field Name',
              description: 'test description 2',
            },
          ],
        })
        assert(result.success === false)
      })
    })

    describe('description validation', () => {
      it('should accept valid descriptions', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
              description: 'This is a valid description',
            },
          ],
        })
        assert(result.success === true)
        assert(
          result.data.responseFields[0].description ===
            'This is a valid description',
        )
      })

      it('should reject empty descriptions', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
              description: '',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should accept a single long description under the total limit', () => {
        const longDescription = 'a'.repeat(5000)
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
              description: longDescription,
            },
          ],
        })
        assert(result.success === true)
      })

      it('should reject when total description length across all fields exceeds 10,000 characters', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
              description: 'a'.repeat(5000),
            },
            {
              fieldName: 'field2',
              description: 'b'.repeat(5001),
            },
          ],
        })
        assert(result.success === false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Total length of all descriptions cannot exceed 10000 characters',
          )
        }
      })

      it('should accept when total description length across all fields is exactly 10,000 characters', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
              description: 'a'.repeat(5000),
            },
            {
              fieldName: 'field2',
              description: 'b'.repeat(5000),
            },
          ],
        })
        assert(result.success === true)
      })

      it('should require description field', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'field1',
            },
          ],
        })
        assert(result.success === false)
      })
    })

    describe('multiple fields validation', () => {
      it('should accept multiple valid response fields', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [
            {
              fieldName: 'Signature present',
              description: 'Check if signature is present',
            },
            {
              fieldName: 'Document type',
              description: 'Type of document',
            },
            {
              fieldName: 'field3',
              description: 'Another field',
            },
          ],
        })
        assert(result.success === true)
        assert(result.data.responseFields.length === 3)
        assert(result.data.responseFields[0].fieldName === 'Signature_present')
        assert(result.data.responseFields[1].fieldName === 'Document_type')
        assert(result.data.responseFields[2].fieldName === 'field3')
      })

      it('should reject empty response fields array', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
          responseFields: [],
        })
        assert(result.success === false)
      })

      it('should require at least one response field', () => {
        const result = schema.safeParse({
          image: ['s3-id-123'],
        })
        assert(result.success === false)
      })
    })
  })

  describe('complete schema validation', () => {
    it('should validate a complete configuration with transformations', () => {
      const result = schema.safeParse({
        image: ['s3-id-abc123'],
        responseFields: [
          {
            fieldName: 'Signature present',
            description: 'Whether the image contains a handwritten signature',
          },
          {
            fieldName: 'Document type',
            description: 'Type of document in the image',
          },
          {
            fieldName: 'confidence',
            description: 'Confidence level of the analysis',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.image.length === 1)
      assert(result.data.responseFields.length === 3)
      assert(result.data.responseFields[0].fieldName === 'Signature_present')
      assert(result.data.responseFields[1].fieldName === 'Document_type')
      assert(result.data.responseFields[2].fieldName === 'confidence')
    })
  })
})
