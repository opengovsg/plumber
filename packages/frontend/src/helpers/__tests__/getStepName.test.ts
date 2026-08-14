import { IApp, IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import getStepName from '@/helpers/getStepName'

function createMockStep(overrides: Partial<IStep> = {}): IStep {
  return {
    id: 'step-1',
    flowId: 'flow-1',
    iconUrl: '',
    webhookUrl: '',
    type: 'action',
    status: 'incomplete',
    position: 1,
    parameters: {},
    executionSteps: [],
    config: {},
    createdAt: '',
    ...overrides,
  } as IStep
}

function createMockApp(overrides: Partial<IApp> = {}): IApp {
  return {
    key: 'testApp',
    name: 'Test App',
    iconUrl: '',
    primaryColor: '',
    authDocUrl: '',
    actions: [{ key: 'testAction', name: 'Test Action' }],
    triggers: [{ key: 'testTrigger', name: 'Test Trigger' }],
    ...overrides,
  } as IApp
}

describe('getStepName', () => {
  it('returns empty strings for undefined step', () => {
    const result = getStepName([], undefined)
    expect(result).toEqual({ stepName: '', defaultStepName: '' })
  })

  describe('IfThen steps', () => {
    const ifThenStep = createMockStep({
      appKey: 'toolbox',
      key: 'ifThen',
    })

    it('returns custom name when config.stepName is set', () => {
      const step = createMockStep({
        ...ifThenStep,
        config: { stepName: 'My Condition' },
      })
      const result = getStepName([], step)
      expect(result).toEqual({
        stepName: 'My Condition',
        defaultStepName: 'If-then',
      })
    })

    it('returns "If-then" when no custom name', () => {
      const result = getStepName([], ifThenStep)
      expect(result).toEqual({
        stepName: 'If-then',
        defaultStepName: 'If-then',
      })
    })

    it('ignores branchName when the flag param is omitted, even if set', () => {
      const step = createMockStep({
        ...ifThenStep,
        parameters: { branchName: 'Branch 1' },
      })
      const result = getStepName([], step)
      expect(result).toEqual({
        stepName: 'If-then',
        defaultStepName: 'If-then',
      })
    })

    it('ignores branchName when the flag is explicitly off', () => {
      const step = createMockStep({
        ...ifThenStep,
        parameters: { branchName: 'Branch 1' },
        config: { stepName: 'My Condition' },
      })
      const result = getStepName([], step, false)
      expect(result).toEqual({
        stepName: 'My Condition',
        defaultStepName: 'If-then',
      })
    })

    it('ignores branchName for a V2 step even when the flag is on', () => {
      const step = createMockStep({
        ...ifThenStep,
        parameters: { branchName: 'Branch 1' },
        config: { endStepId: 'step-2' },
      })
      const result = getStepName([], step, true)
      expect(result).toEqual({
        stepName: 'If-then',
        defaultStepName: 'If-then',
      })
    })

    it('combines branchName and stepName for a leftover V1 step when the flag is on', () => {
      const step = createMockStep({
        ...ifThenStep,
        parameters: { branchName: 'Branch 1' },
        config: { stepName: 'My Condition' },
      })
      const result = getStepName([], step, true)
      expect(result).toEqual({
        stepName: 'Branch 1 (My Condition)',
        defaultStepName: 'Branch 1',
      })
    })

    it('falls back to branchName alone for a leftover V1 step with no stepName, flag on', () => {
      const step = createMockStep({
        ...ifThenStep,
        parameters: { branchName: 'Branch 1' },
      })
      const result = getStepName([], step, true)
      expect(result).toEqual({
        stepName: 'Branch 1',
        defaultStepName: 'Branch 1',
      })
    })

    it('falls back to "If-then" for a leftover V1 step with no branchName, flag on', () => {
      const result = getStepName([], ifThenStep, true)
      expect(result).toEqual({
        stepName: 'If-then',
        defaultStepName: 'If-then',
      })
    })

    it('falls back to "If-then" when config.stepName was explicitly cleared to an empty string', () => {
      const step = createMockStep({
        ...ifThenStep,
        config: { stepName: '' },
      })
      const result = getStepName([], step)
      expect(result).toEqual({
        stepName: 'If-then',
        defaultStepName: 'If-then',
      })
    })
  })

  describe('ForEach steps', () => {
    const forEachStep = createMockStep({
      appKey: 'toolbox',
      key: 'forEach',
    })

    it('returns custom name when config.stepName is set', () => {
      const step = createMockStep({
        ...forEachStep,
        config: { stepName: 'Loop Items' },
      })
      const result = getStepName([], step)
      expect(result).toEqual({
        stepName: 'Loop Items',
        defaultStepName: 'For each item',
      })
    })

    it('falls back to "For each item" when config.stepName was explicitly cleared to an empty string', () => {
      const step = createMockStep({
        ...forEachStep,
        config: { stepName: '' },
      })
      const result = getStepName([], step)
      expect(result).toEqual({
        stepName: 'For each item',
        defaultStepName: 'For each item',
      })
    })

    it('returns "For each item" when no custom name', () => {
      const result = getStepName([], forEachStep)
      expect(result).toEqual({
        stepName: 'For each item',
        defaultStepName: 'For each item',
      })
    })
  })

  describe('regular action steps', () => {
    const app = createMockApp()

    it('returns custom stepName from config when set', () => {
      const step = createMockStep({
        appKey: 'testApp',
        key: 'testAction',
        config: { stepName: 'Send notification' },
      })
      const result = getStepName([app], step)
      expect(result.stepName).toBe('Send notification')
      expect(result.defaultStepName).toBe('Test Action')
    })

    it('returns action name as both stepName and defaultStepName when no custom name', () => {
      const step = createMockStep({
        appKey: 'testApp',
        key: 'testAction',
      })
      const result = getStepName([app], step)
      expect(result.stepName).toBe('Test Action')
      expect(result.defaultStepName).toBe('Test Action')
    })

    it('falls back to app name when no matching action', () => {
      const step = createMockStep({
        appKey: 'testApp',
        key: 'unknownAction',
      })
      const result = getStepName([app], step)
      expect(result.stepName).toBe('Test App')
      expect(result.defaultStepName).toBeUndefined()
    })
  })

  describe('trigger steps', () => {
    it('returns trigger name when matched', () => {
      const app = createMockApp()
      const step = createMockStep({
        type: 'trigger',
        appKey: 'testApp',
        key: 'testTrigger',
      })
      const result = getStepName([app], step)
      expect(result.stepName).toBe('Test Trigger')
      expect(result.defaultStepName).toBe('Test Trigger')
    })

    it('returns fallback message when no app/action match', () => {
      const step = createMockStep({
        type: 'trigger',
        appKey: 'unknownApp',
        key: 'unknownTrigger',
      })
      const result = getStepName([], step)
      expect(result.stepName).toBe('This step starts your pipe')
    })
  })

  describe('fallbacks', () => {
    it('capitalizes appKey when no other name is available', () => {
      const step = createMockStep({
        appKey: 'myapp',
        key: 'unknownAction',
      })
      const result = getStepName([], step)
      expect(result.stepName).toBe('Myapp')
    })

    it('returns empty string when no appKey and no matches', () => {
      const step = createMockStep({
        appKey: undefined,
        key: undefined,
      })
      const result = getStepName([], step)
      expect(result.stepName).toBe('')
    })
  })
})
