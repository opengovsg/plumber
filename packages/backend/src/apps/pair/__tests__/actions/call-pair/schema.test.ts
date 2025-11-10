import { assert, describe, expect, it } from 'vitest'

import { schema } from '../../../actions/call-pair/schema'

describe('call-pair schema', () => {
  describe('promptType validation', () => {
    it('should accept valid prompt types', () => {
      const validTypes = [
        'analyse',
        'categorise',
        'summarise',
        'write',
        'custom',
      ]

      validTypes.forEach((promptType) => {
        const result = schema.safeParse({
          promptType,
          prompt: 'test prompt',
        })
        assert(result.success === true)
        assert(result.data.promptType === promptType)
      })
    })

    it('should reject invalid prompt types', () => {
      const result = schema.safeParse({
        promptType: 'invalid',
        prompt: 'test prompt',
      })
      assert(result.success === false)
    })

    it('should require promptType', () => {
      const result = schema.safeParse({
        prompt: 'test prompt',
      })
      assert(result.success === false)
    })
  })

  describe('prompt validation', () => {
    it('should accept valid non-empty prompts', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'Analyze this document',
      })
      assert(result.success === true)
      assert(result.data.prompt === 'Analyze this document')
    })

    it('should reject empty prompts', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: '',
      })
      assert(result.success === false)
    })

    it('should require prompt field', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
      })
      assert(result.success === false)
    })
  })

  describe('responseFormat validation', () => {
    it('should default to singleField when not provided', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'test prompt',
      })
      assert(result.success === true)
      assert(result.data.responseFormat === 'singleField')
    })

    it('should accept singleField', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'test prompt',
        responseFormat: 'singleField',
      })
      assert(result.success === true)
      assert(result.data.responseFormat === 'singleField')
    })

    it('should accept multipleFields', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'test prompt',
        responseFormat: 'multipleFields',
        responseFields: [
          {
            fieldName: 'field1',
            fieldType: 'text',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.responseFormat === 'multipleFields')
    })

    it('should reject invalid responseFormat values', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'test prompt',
        responseFormat: 'invalid',
      })
      assert(result.success === false)
    })
  })

  describe('responseFields validation', () => {
    it('should default to empty array when not provided', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'test prompt',
      })
      assert(result.success === true)
      assert(Array.isArray(result.data.responseFields))
      assert(result.data.responseFields.length === 0)
    })

    describe('fieldName validation', () => {
      it.each([
        'field1',
        'field_name',
        'field-name',
        'Field123',
        'field_123-test',
        'ABC123_test-name',
      ])(
        'should accept valid field names with letters, numbers, underscores, and hyphens: %s',
        (fieldName) => {
          const result = schema.safeParse({
            promptType: 'analyse',
            prompt: 'test prompt',
            responseFormat: 'multipleFields',
            responseFields: [
              {
                fieldName,
                fieldType: 'text',
              },
            ],
          })
          assert(result.success === true)
          assert(result.data.responseFields[0].fieldName === fieldName)
        },
      )

      it.each([
        'field name',
        'field@name',
        'field.name',
        'field#name',
        'field!name',
        'field$name',
      ])(
        'should reject field names with invalid characters: %s',
        (fieldName) => {
          const result = schema.safeParse({
            promptType: 'analyse',
            prompt: 'test prompt',
            responseFormat: 'multipleFields',
            responseFields: [{ fieldName, fieldType: 'text' }],
          })
          assert(result.success === false)
        },
      )

      it('should reject empty field names', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
          responseFields: [
            {
              fieldName: maxName,
              fieldType: 'text',
            },
          ],
        })
        assert(result.success === true)
      })
    })

    describe('fieldType validation', () => {
      it('should accept text field type', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
          responseFields: [
            {
              fieldName: 'field1',
              fieldType: 'invalid',
            },
          ],
        })
        assert(result.success === false)
      })
    })

    describe('fieldCategories validation', () => {
      it('should require fieldCategories when fieldType is category', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
            'Categories are required when field type is category. Enter comma-separated values',
          )
        }
      })

      it('should accept valid comma-separated categories', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
            promptType: 'analyse',
            prompt: 'test prompt',
            responseFormat: 'multipleFields',
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

      it('should allow fieldCategories to be optional when fieldType is not category', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
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

      it('should require at least one field when responseFormat is multipleFields', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'multipleFields',
          responseFields: [],
        })
        assert(result.success === false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            'Response fields must contain at least one field when response format is multiple fields',
          )
          expect(result.error.issues[0].path).toEqual(['responseFields'])
        }
      })

      it('should allow empty responseFields when responseFormat is singleField', () => {
        const result = schema.safeParse({
          promptType: 'analyse',
          prompt: 'test prompt',
          responseFormat: 'singleField',
          responseFields: [],
        })
        assert(result.success === true)
      })
    })
  })

  describe('complete schema validation', () => {
    it('should validate a complete singleField configuration', () => {
      const result = schema.safeParse({
        promptType: 'summarise',
        prompt: 'Summarize this document',
        responseFormat: 'singleField',
      })
      assert(result.success === true)
      assert(result.data.promptType === 'summarise')
      assert(result.data.prompt === 'Summarize this document')
      assert(result.data.responseFormat === 'singleField')
      assert(result.data.responseFields.length === 0)
    })

    it('should validate a complete multipleFields configuration', () => {
      const result = schema.safeParse({
        promptType: 'analyse',
        prompt: 'Analyze the sentiment and extract key information',
        responseFormat: 'multipleFields',
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
            fieldName: 'confidence_score',
            fieldType: 'number',
          },
        ],
      })
      assert(result.success === true)
      assert(result.data.promptType === 'analyse')
      assert(result.data.responseFormat === 'multipleFields')
      assert(result.data.responseFields.length === 3)
    })
  })
})
