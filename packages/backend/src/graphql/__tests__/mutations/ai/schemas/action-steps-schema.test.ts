import type { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { StepEnumType } from '@/graphql/__generated__/types.generated'
import { actionStepsSchema } from '@/graphql/mutations/ai/schemas/action-steps-schema'

describe('actionStepsSchema validation', () => {
  describe('basic validation', () => {
    it('should accept valid action steps', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject empty action steps array', () => {
      const steps: IStep[] = []

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
    })

    it('should accept single action step', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })
  })

  describe('if-then validation', () => {
    it('should accept valid if-then step with depth: 0 and branchName', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject if-then step with depth other than 0', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 1, // Should be 0
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
    })

    it('should accept if-then step missing branchName parameter', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            // missing branchName
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject if-then step missing depth parameter', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            // missing depth
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
    })

    it('should reject if-then step as last action', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'If-then actions must have another action immediately after them',
        )
      }
    })

    it('should reject consecutive if-then actions', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'Else',
          },
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'If-then actions cannot be consecutive',
        )
      }
    })

    it('should accept alternating if-then and non-if-then actions', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 4,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'Else',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })
  })

  describe('for-each validation', () => {
    it('should accept single for-each action in pipe', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject multiple for-each actions in pipe', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 4,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'There can only be 1 for-each action in each pipe',
        )
      }
    })

    it('should reject for-each action immediately after if-then', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'For-each action cannot be placed after an if-then action',
        )
      }
    })

    it('should accept for-each action before if-then', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 4,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject for-each even with non-if-then action in between', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'For-each action cannot be placed after an if-then action',
        )
      }
    })
  })

  describe('delay action validation', () => {
    it('should accept delay action before for-each', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 4,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject delay action immediately after for-each', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor',
          position: 3,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'Delay action cannot be added after a for-each step',
        )
      }
    })

    it('should reject delay action anywhere after for-each', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayUntil',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'Delay action cannot be added after a for-each step',
        )
      }
    })

    it('should accept delay action in pipe without for-each', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 4,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })
  })

  describe('complex scenarios', () => {
    it('should reject multiple violations at once', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach', // Second for-each (violation 1)
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor', // Delay after for-each (violation 2)
          position: 4,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.errors.length).toBeGreaterThan(1)
      }
    })

    it('should accept valid complex pipe: action -> delay -> for-each -> action', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should accept valid complex pipe: for-each -> if-then -> action -> if-then -> action', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 3,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 5,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'Else',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 6,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject if-then at the end even with multiple actions before', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 4,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
    })

    it('should accept valid workflow: delay -> for-each -> if-then -> action (for-each before if-then is OK)', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'delay',
          key: 'delayFor',
          position: 2,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 4,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(true)
    })

    it('should reject for-each anywhere after if-then, even with multiple actions in between', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'For-each action cannot be placed after an if-then action',
        )
      }
    })

    it('should reject workflow: if-then -> for-each (immediate after)', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 4,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have error about for-each after if-then
        const hasForEachError = result.error.errors.some((err) =>
          err.message.includes('For-each action cannot be placed after'),
        )
        expect(hasForEachError).toBe(true)
      }
    })

    it('should reject workflow: if-then -> action -> for-each (immediate after)', () => {
      const steps = [
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'ifThen',
          position: 2,
          config: {},
          parameters: {
            depth: 0,
            branchName: 'If',
          },
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          position: 3,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'toolbox',
          key: 'forEach',
          position: 4,
          config: {},
        },
        {
          type: 'action' as StepEnumType,
          appKey: 'slack',
          key: 'sendMessageToChannel',
          position: 5,
          config: {},
        },
      ]

      const result = actionStepsSchema.safeParse(steps)
      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have error about for-each after if-then
        const hasForEachError = result.error.errors.some((err) =>
          err.message.includes('For-each action cannot be placed after'),
        )
        expect(hasForEachError).toBe(true)
      }
    })
  })
})
