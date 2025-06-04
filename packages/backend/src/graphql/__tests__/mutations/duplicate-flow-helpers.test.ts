import { describe, expect, it } from 'vitest'

import {
  updateStepIdForKey,
  updateStepVariables,
} from '@/helpers/update-duplicated-steps'

describe('duplicate flow helper functions', () => {
  describe('updateStepIdForKey', () => {
    const stepIdMap = {
      'old-step-1': 'new-step-1',
      'old-step-2': 'new-step-2',
      'old-step-3': 'new-step-3',
    }

    it('should replace step IDs in simple variable references', () => {
      const input = '{{step.old-step-1.fields.name}}'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('{{step.new-step-1.fields.name}}')
    })

    it('should replace multiple step IDs in the same string', () => {
      const input =
        'Hello {{step.old-step-1.output.name}} and {{step.old-step-2.fields.email}}'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe(
        'Hello {{step.new-step-1.output.name}} and {{step.new-step-2.fields.email}}',
      )
    })

    it('should handle complex variable paths', () => {
      const input = '{{step.old-step-1.fields.123.answer}}'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('{{step.new-step-1.fields.123.answer}}')
    })

    it('should not affect non-step variables', () => {
      const input = 'Hello {{user.name}} and {{config.setting}}'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('Hello {{user.name}} and {{config.setting}}')
    })

    it('should handle data-id attributes in HTML/XML', () => {
      const input = '<div data-id="step.old-step-1.output">Content</div>'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('<div data-id="step.new-step-1.output">Content</div>')
    })

    it('should handle mixed content with variables and plain text', () => {
      const input =
        'Subject: {{step.old-step-1.fields.subject}} - Reply to {{step.old-step-2.email}}'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe(
        'Subject: {{step.new-step-1.fields.subject}} - Reply to {{step.new-step-2.email}}',
      )
    })

    it('should not replace partial matches', () => {
      const input = 'step.old-step-12.field should not change'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('step.old-step-12.field should not change')
    })

    it('should handle empty string', () => {
      const result = updateStepIdForKey('', stepIdMap)
      expect(result).toBe('')
    })

    it('should handle string with no step references', () => {
      const input = 'This is just plain text'
      const result = updateStepIdForKey(input, stepIdMap)
      expect(result).toBe('This is just plain text')
    })

    it('should handle empty step ID map', () => {
      const input = '{{step.old-step-1.fields.name}}'
      const result = updateStepIdForKey(input, {})
      expect(result).toBe('{{step.old-step-1.fields.name}}')
    })
  })

  describe('updateStepVariables', () => {
    const stepIdMap = {
      'old-step-1': 'new-step-1',
      'old-step-2': 'new-step-2',
    }

    it('should update string parameters', () => {
      const parameters = {
        subject: '{{step.old-step-1.fields.title}}',
        body: 'Static text',
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        subject: '{{step.new-step-1.fields.title}}',
        body: 'Static text',
      })
    })

    it('should update nested object parameters', () => {
      const parameters = {
        config: {
          url: '{{step.old-step-1.output.url}}',
          headers: {
            auth: '{{step.old-step-2.token}}',
          },
        },
        static: 'value',
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        config: {
          url: '{{step.new-step-1.output.url}}',
          headers: {
            auth: '{{step.new-step-2.token}}',
          },
        },
        static: 'value',
      })
    })

    it('should filter out S3 object keys from arrays', () => {
      const parameters = {
        attachments: [
          's3:bucket:file1.pdf',
          's3:another-bucket:file2.pdf',
          '{{step.old-step-1.attachment}}',
        ],
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        attachments: ['{{step.new-step-1.attachment}}'],
      })
    })

    it('should update step variables in array of objects', () => {
      const parameters = {
        conditions: [
          {
            field: 'status',
            value: '{{step.old-step-1.status}}',
          },
          {
            field: 'email',
            value: '{{step.old-step-2.email}}',
          },
        ],
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        conditions: [
          {
            field: 'status',
            value: '{{step.new-step-1.status}}',
          },
          {
            field: 'email',
            value: '{{step.new-step-2.email}}',
          },
        ],
      })
    })

    it('should handle array with only S3 attachments', () => {
      const parameters = {
        files: ['s3:bucket:file1.pdf', 's3:bucket:file2.pdf'],
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        files: [],
      })
    })

    it('should handle mixed array with strings and objects', () => {
      const parameters = {
        mixed: [
          '{{step.old-step-1.value}}',
          's3:bucket:file.pdf',
          {
            type: 'condition',
            value: '{{step.old-step-2.condition}}',
          },
          'static-string',
        ],
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        mixed: [
          '{{step.new-step-1.value}}',
          {
            type: 'condition',
            value: '{{step.new-step-2.condition}}',
          },
          'static-string',
        ],
      })
    })

    it('should handle deeply nested structures', () => {
      const parameters = {
        level1: {
          level2: {
            level3: {
              value: '{{step.old-step-1.deep.value}}',
              array: [
                {
                  nested: '{{step.old-step-2.nested}}',
                },
              ],
            },
          },
        },
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: '{{step.new-step-1.deep.value}}',
              array: [
                {
                  nested: '{{step.new-step-2.nested}}',
                },
              ],
            },
          },
        },
      })
    })

    it('should handle empty parameters object', () => {
      const result = updateStepVariables({}, stepIdMap)
      expect(result).toEqual({})
    })

    it('should handle parameters with null and undefined values', () => {
      const parameters: Record<string, any> = {
        nullValue: null,
        undefinedValue: undefined,
        stringValue: '{{step.old-step-1.value}}',
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        nullValue: null,
        undefinedValue: undefined,
        stringValue: '{{step.new-step-1.value}}',
      })
    })

    it('should handle parameters with number and boolean values', () => {
      const parameters = {
        number: 42,
        boolean: true,
        string: '{{step.old-step-1.value}}',
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        number: 42,
        boolean: true,
        string: '{{step.new-step-1.value}}',
      })
    })

    it('should handle empty arrays', () => {
      const parameters: Record<string, any> = {
        emptyArray: [],
        stringValue: '{{step.old-step-1.value}}',
      }

      const result = updateStepVariables(parameters, stepIdMap)

      expect(result).toEqual({
        emptyArray: [],
        stringValue: '{{step.new-step-1.value}}',
      })
    })
  })
})
