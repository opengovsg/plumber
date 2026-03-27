import { assert, describe, expect, it } from 'vitest'
import z from 'zod/v3'

import { generateSchemaFromFields } from '../../common/generate-schema'

describe('generateSchemaFromFields', () => {
  describe('text field type', () => {
    it('should generate a string schema for text field', () => {
      const fields = [
        {
          fieldName: 'description',
          fieldType: 'text' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ description: 'test text' })

      assert(result.success === true)
      expect(result.data.description).toBe('test text')
    })

    it('should reject non-string values for text field', () => {
      const fields = [
        {
          fieldName: 'description',
          fieldType: 'text' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ description: 123 })

      assert(result.success === false)
    })

    it('should include field description for text field', () => {
      const fields = [
        {
          fieldName: 'summary',
          fieldType: 'text' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const schemaShape = schema._def.shape()

      expect(schemaShape.summary.description).toBe('Text field: summary')
    })
  })

  describe('number field type', () => {
    it('should generate a number schema for number field', () => {
      const fields = [
        {
          fieldName: 'count',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ count: 42 })

      assert(result.success === true)
      expect(result.data.count).toBe(42)
    })

    it('should accept decimal numbers', () => {
      const fields = [
        {
          fieldName: 'score',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ score: 98.5 })

      assert(result.success === true)
      expect(result.data.score).toBe(98.5)
    })

    it('should reject non-number values for number field', () => {
      const fields = [
        {
          fieldName: 'count',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ count: 'not a number' })

      assert(result.success === false)
    })

    it('should include field description for number field', () => {
      const fields = [
        {
          fieldName: 'amount',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const schemaShape = schema._def.shape()

      expect(schemaShape.amount.description).toBe('Number field: amount')
    })
  })

  describe('category field type', () => {
    it('should generate an enum schema for category field with valid categories', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: 'pending, approved, rejected',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'approved' })

      assert(result.success === true)
      expect(result.data.status).toBe('approved')
    })

    it('should accept all valid category values', () => {
      const fields = [
        {
          fieldName: 'priority',
          fieldType: 'category' as const,
          fieldCategories: 'low, medium, high',
        },
      ]

      const schema = generateSchemaFromFields(fields)

      const lowResult = schema.safeParse({ priority: 'low' })
      assert(lowResult.success === true)

      const mediumResult = schema.safeParse({ priority: 'medium' })
      assert(mediumResult.success === true)

      const highResult = schema.safeParse({ priority: 'high' })
      assert(highResult.success === true)
    })

    it('should reject invalid category values', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: 'pending, approved, rejected',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'invalid' })

      assert(result.success === false)
    })

    it('should handle categories without spaces after commas', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: 'active,inactive,archived',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'active' })

      assert(result.success === true)
      expect(result.data.status).toBe('active')
    })

    it('should trim whitespace from category values', () => {
      const fields = [
        {
          fieldName: 'type',
          fieldType: 'category' as const,
          fieldCategories: '  option1  ,  option2  ,  option3  ',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ type: 'option1' })

      assert(result.success === true)
      expect(result.data.type).toBe('option1')
    })

    it('should filter out empty category values after trimming', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: 'valid1, , valid2,  , valid3',
        },
      ]

      const schema = generateSchemaFromFields(fields)

      const valid1Result = schema.safeParse({ status: 'valid1' })
      const valid2Result = schema.safeParse({ status: 'valid2' })
      const valid3Result = schema.safeParse({ status: 'valid3' })

      assert(valid1Result.success === true)
      assert(valid2Result.success === true)
      assert(valid3Result.success === true)
    })

    it('should include category values in field description', () => {
      const fields = [
        {
          fieldName: 'color',
          fieldType: 'category' as const,
          fieldCategories: 'red, blue, green',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const schemaShape = schema._def.shape()

      expect(schemaShape.color.description).toBe(
        'Category field: color. Must be one of: red, blue, green',
      )
    })

    it('should fall back to string schema when fieldCategories is missing', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'any string' })

      assert(result.success === true)
      expect(result.data.status).toBe('any string')
    })

    it('should fall back to string schema when fieldCategories is empty', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: '',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'any string' })

      assert(result.success === true)
      expect(result.data.status).toBe('any string')
    })

    it('should fall back to string schema when all categories are empty after filtering', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: '  ,  ,  ',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'any string' })

      assert(result.success === true)
      expect(result.data.status).toBe('any string')
    })
  })

  describe('field name handling', () => {
    it('should handle field names with special characters allowed by schema', () => {
      const fields = [
        {
          fieldName: 'field_name-123',
          fieldType: 'text' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ 'field_name-123': 'test' })

      assert(result.success === true)
      expect(result.data['field_name-123']).toBe('test')
    })
  })

  describe('multiple fields', () => {
    it('should generate schema for multiple fields of different types', () => {
      const fields = [
        {
          fieldName: 'title',
          fieldType: 'text' as const,
        },
        {
          fieldName: 'count',
          fieldType: 'number' as const,
        },
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: 'active, inactive',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({
        title: 'Test Title',
        count: 42,
        status: 'active',
      })

      assert(result.success === true)
      expect(result.data.title).toBe('Test Title')
      expect(result.data.count).toBe(42)
      expect(result.data.status).toBe('active')
    })

    it('should reject when any field has invalid value', () => {
      const fields = [
        {
          fieldName: 'name',
          fieldType: 'text' as const,
        },
        {
          fieldName: 'age',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({
        name: 'John',
        age: 'not a number',
      })

      assert(result.success === false)
    })

    it('should require all defined fields', () => {
      const fields = [
        {
          fieldName: 'required1',
          fieldType: 'text' as const,
        },
        {
          fieldName: 'required2',
          fieldType: 'number' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({
        required1: 'value',
        // missing required2
      })

      assert(result.success === false)
    })
  })

  describe('empty fields array', () => {
    it('should generate empty object schema for empty fields array', () => {
      const fields: Array<{
        fieldName?: string
        fieldType?: 'text' | 'number' | 'category'
        fieldCategories?: string
      }> = []

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({})

      assert(result.success === true)
      expect(result.data).toEqual({})
    })

    it('should reject non-empty object when schema is empty', () => {
      const fields: Array<{
        fieldName?: string
        fieldType?: 'text' | 'number' | 'category'
        fieldCategories?: string
      }> = []

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ extraField: 'value' })

      assert(result.success === false)
    })
  })

  describe('edge cases', () => {
    it('should handle single category value', () => {
      const fields = [
        {
          fieldName: 'single',
          fieldType: 'category' as const,
          fieldCategories: 'only_option',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ single: 'only_option' })

      assert(result.success === true)
      expect(result.data.single).toBe('only_option')
    })

    it('should handle categories with leading/trailing commas', () => {
      const fields = [
        {
          fieldName: 'status',
          fieldType: 'category' as const,
          fieldCategories: ',option1,option2,',
        },
      ]

      const schema = generateSchemaFromFields(fields)
      const result = schema.safeParse({ status: 'option1' })

      assert(result.success === true)
      expect(result.data.status).toBe('option1')
    })

    it('should maintain zod object structure', () => {
      const fields = [
        {
          fieldName: 'test',
          fieldType: 'text' as const,
        },
      ]

      const schema = generateSchemaFromFields(fields)

      expect(schema).toBeInstanceOf(z.ZodObject)
    })
  })
})
