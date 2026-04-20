import { assert, describe, expect, it } from 'vitest'

import { schema } from '@/apps/pair/actions/send-prompt/schema'

describe('call-pair schema', () => {
  describe('prompt validation', () => {
    it('should accept valid non-empty prompts', () => {
      const result = schema.safeParse({
        prompt: 'Analyze this document',
        responseFields: [
          {
            fieldName: 'summary',
            fieldType: 'text',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.prompt === 'Analyze this document')
    })

    it('should reject empty prompts', () => {
      const result = schema.safeParse({
        prompt: '',
      })
      assert(result.success === false)
    })

    it('should require prompt field', () => {
      const result = schema.safeParse({})
      assert(result.success === false)
    })
  })

  describe('responseFields validation', () => {
    describe('fieldName validation', () => {
      it.each([
        'field1',
        'Field123',
        'field name',
        'field 123',
        'ABC 123 Test',
        'field with   multiple spaces',
      ])(
        'should accept valid field names with letters, numbers, and spaces: %s',
        (fieldName) => {
          const result = schema.safeParse({
            prompt: 'test prompt',
            responseFields: [
              {
                fieldName,
                fieldType: 'text',
              },
            ],
          })
          assert(result.success === true)
          const parsedField = result.data.responseFields[0]
          assert(parsedField.fieldName === fieldName.replace(/\s/g, '_'))
          assert(parsedField.originalFieldName === fieldName)
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
            prompt: 'test prompt',
            responseFields: [{ fieldName, fieldType: 'text' }],
          })
          assert(result.success === false)
        },
      )

      it('should reject empty field names', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: '',
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should reject field names longer than 64 characters', () => {
        const longName = 'a'.repeat(65)
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: longName,
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should accept field names exactly 64 characters long', () => {
        const maxName = 'a'.repeat(64)
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: maxName,
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === true)
      })

      it('should not accept duplicate field names (case-insensitive)', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'Field 1',
              fieldType: 'text',
            },
            {
              fieldName: 'field 1',
              fieldType: 'text',
            },
            {
              fieldName: 'field2',
              fieldType: 'number',
            },
            {
              fieldName: 'field3',
              fieldType: 'category',
              fieldCategories: 'A, B, C',
            },
          ],
        })
        assert(result.success === false)
      })
    })

    describe('fieldType validation', () => {
      it('should accept text field type', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === true)
        assert(result.data.responseFields[0].fieldType === 'text')
      })

      it('should accept number field type', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'number',
            },
          ],
        })
        assert(result.success === true)
        assert(result.data.responseFields[0].fieldType === 'number')
      })

      it('should accept category field type with valid categories', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'category',
              fieldCategories: 'option1, option2, option3',
            },
          ],
        })
        assert(result.success === true)
        assert(result.data.responseFields[0].fieldType === 'category')
      })

      it('should reject invalid field types', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'invalid',
            },
          ],
        })
        assert(result.success === false)
      })

      it('should reject empty response fields', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [],
        })
        assert(result.success === false)
      })

      it('should reject non-existent response fields', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
        })
        assert(result.success === false)
      })
    })

    describe('fieldCategories validation', () => {
      it('should require fieldCategories when fieldType is category', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'category',
            },
          ],
        })
        assert(result.success === false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Enter categories as comma-separated values with no empty or duplicate entries.',
          )
        }
      })

      it('should accept valid comma-separated categories', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'category',
              fieldCategories: 'red, blue, green',
            },
          ],
        })
        assert(result.success === true)
      })

      it('should accept categories without spaces', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'category',
              fieldCategories: 'red,blue,green',
            },
          ],
        })
        assert(result.success === true)
      })

      it('should reject empty categories when fieldType is category', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'category',
              fieldCategories: '',
            },
          ],
        })
        assert(result.success === false)
      })

      it.each([
        ',',
        'red,,blue',
        'red, ,blue',
        ',red,blue',
        'red,blue,',
        '  ,  ,  ',
      ])(
        'should reject categories with empty items after trimming: %s',
        (fieldCategories) => {
          const result = schema.safeParse({
            prompt: 'test prompt',
            responseFields: [
              {
                fieldName: 'field1',
                fieldType: 'category',
                fieldCategories,
              },
            ],
          })
          assert(result.success === false)
        },
      )

      it.each([
        'red,blue,red',
        'red, blue, red',
        'red,blue,Red',
        'Red, Blue, red',
        'apple, banana, APPLE',
        'A,B,C,a',
      ])(
        'should reject categories with duplicates (case-insensitive): %s',
        (fieldCategories) => {
          const result = schema.safeParse({
            prompt: 'test prompt',
            responseFields: [
              {
                fieldName: 'field1',
                fieldType: 'category',
                fieldCategories,
              },
            ],
          })
          assert(result.success === false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(
              'Enter categories as comma-separated values with no empty or duplicate entries.',
            )
          }
        },
      )

      it('should allow fieldCategories to be optional when fieldType is not category', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === true)
        expect(result.data.responseFields[0].fieldCategories).toBeUndefined()
      })
    })

    describe('multiple fields validation', () => {
      it('should accept multiple valid response fields', () => {
        const result = schema.safeParse({
          prompt: 'test prompt',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'text',
            },
            {
              fieldName: 'field2',
              fieldType: 'number',
            },
            {
              fieldName: 'field3',
              fieldType: 'category',
              fieldCategories: 'A, B, C',
            },
          ],
        })
        assert(result.success === true)
        assert(result.data.responseFields.length === 3)
      })
    })
  })

  describe('complete schema validation', () => {
    it('should validate a complete configuration', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'Analyze the sentiment and extract key information',
        responseFields: [
          {
            fieldName: 'sentiment',
            fieldType: 'category',
            fieldCategories: 'positive, neutral, negative',
          },
          {
            fieldName: 'summary',
            fieldType: 'text',
          },
          {
            fieldName: 'confidence score',
            fieldType: 'number',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.responseFields.length === 3)
    })
  })
})
