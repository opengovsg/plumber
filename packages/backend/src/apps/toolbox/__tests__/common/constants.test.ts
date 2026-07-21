import { describe, expect, it } from 'vitest'

import {
  BLOCK_END_STEP_ID,
  isBlankPlaceholderStep,
  isBlockStep,
  isForEachStep,
  isIfThenStep,
  isIfThenV2,
  isOnlyContinueIfStep,
  TOOLBOX_ACTIONS,
} from '../../common/constants'

describe('toolbox constants', () => {
  it('exposes the only-continue-if action key', () => {
    expect(TOOLBOX_ACTIONS.ONLY_CONTINUE_IF).toBe('onlyContinueIf')
  })

  it('exposes the block end-step config key', () => {
    expect(BLOCK_END_STEP_ID).toBe('endStepId')
  })

  describe('isIfThenStep', () => {
    it('is true for a toolbox if-then step', () => {
      expect(isIfThenStep({ appKey: 'toolbox', key: 'ifThen' })).toBe(true)
    })

    it.each([
      {
        label: 'only-continue-if',
        step: { appKey: 'toolbox', key: 'onlyContinueIf' },
      },
      { label: 'for-each', step: { appKey: 'toolbox', key: 'forEach' } },
      { label: 'non-toolbox app', step: { appKey: 'formsg', key: 'ifThen' } },
      { label: 'missing key', step: { appKey: 'toolbox' } },
      { label: 'undefined step', step: undefined },
    ])('is false for $label', ({ step }) => {
      expect(isIfThenStep(step)).toBe(false)
    })
  })

  describe('isOnlyContinueIfStep', () => {
    it('is true for a toolbox only-continue-if step', () => {
      expect(
        isOnlyContinueIfStep({ appKey: 'toolbox', key: 'onlyContinueIf' }),
      ).toBe(true)
    })

    it.each([
      { label: 'if-then', step: { appKey: 'toolbox', key: 'ifThen' } },
      { label: 'for-each', step: { appKey: 'toolbox', key: 'forEach' } },
      {
        label: 'non-toolbox app',
        step: { appKey: 'formsg', key: 'onlyContinueIf' },
      },
      { label: 'missing key', step: { appKey: 'toolbox' } },
      { label: 'undefined step', step: undefined },
    ])('is false for $label', ({ step }) => {
      expect(isOnlyContinueIfStep(step)).toBe(false)
    })
  })

  describe('isForEachStep', () => {
    it('is true for a toolbox for-each step', () => {
      expect(isForEachStep({ appKey: 'toolbox', key: 'forEach' })).toBe(true)
    })

    it.each([
      { label: 'if-then', step: { appKey: 'toolbox', key: 'ifThen' } },
      { label: 'non-toolbox app', step: { appKey: 'formsg', key: 'forEach' } },
      { label: 'undefined step', step: undefined },
    ])('is false for $label', ({ step }) => {
      expect(isForEachStep(step)).toBe(false)
    })
  })

  describe('isBlockStep', () => {
    it.each([
      { label: 'if-then', step: { appKey: 'toolbox', key: 'ifThen' } },
      { label: 'for-each', step: { appKey: 'toolbox', key: 'forEach' } },
    ])('is true for a block step: $label', ({ step }) => {
      expect(isBlockStep(step)).toBe(true)
    })

    it.each([
      {
        label: 'only-continue-if',
        step: { appKey: 'toolbox', key: 'onlyContinueIf' },
      },
      { label: 'plain action', step: { appKey: 'postman', key: 'sendEmail' } },
      { label: 'undefined step', step: undefined },
    ])('is false for a non-block step: $label', ({ step }) => {
      expect(isBlockStep(step)).toBe(false)
    })
  })

  describe('isBlankPlaceholderStep', () => {
    it('is true when both appKey and key are missing', () => {
      expect(isBlankPlaceholderStep({})).toBe(true)
    })

    it('is true when both appKey and key are null', () => {
      expect(isBlankPlaceholderStep({ appKey: null, key: null })).toBe(true)
    })

    it.each([
      { label: 'undefined step', step: undefined },
      { label: 'null step', step: null },
    ])('is true for $label', ({ step }) => {
      expect(isBlankPlaceholderStep(step)).toBe(true)
    })

    it.each([
      {
        label: 'a fully-configured step',
        step: { appKey: 'toolbox', key: 'ifThen' },
      },
      { label: 'appKey set but key missing', step: { appKey: 'toolbox' } },
      { label: 'key set but appKey missing', step: { key: 'ifThen' } },
    ])('is false for $label', ({ step }) => {
      expect(isBlankPlaceholderStep(step)).toBe(false)
    })
  })

  describe('isIfThenV2', () => {
    it('is true when an if-then carries the endStepId config key', () => {
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [BLOCK_END_STEP_ID]: 'step-abc' },
        }),
      ).toBe(true)
    })

    it('is true when endStepId is a self-reference (empty-block marker)', () => {
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [BLOCK_END_STEP_ID]: 'own-id' },
        }),
      ).toBe(true)
    })

    it('checks own-key presence, not value (present-but-undefined counts)', () => {
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [BLOCK_END_STEP_ID]: undefined },
        }),
      ).toBe(true)
    })

    it('is false for a legacy if-then without the endStepId config key', () => {
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { stepName: 'legacy branch' },
        }),
      ).toBe(false)
    })

    it('ignores endStepId in parameters (config-only marker)', () => {
      // A real Step carries both parameters and config; the marker only counts
      // when it lives in config (cast because StepLike omits parameters).
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { [BLOCK_END_STEP_ID]: 'step-abc' },
          config: {},
        } as any),
      ).toBe(false)
    })

    it('is false when config is missing', () => {
      expect(isIfThenV2({ appKey: 'toolbox', key: 'ifThen' })).toBe(false)
    })

    it('is false for a non-if-then step even if it carries endStepId', () => {
      expect(
        isIfThenV2({
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          config: { [BLOCK_END_STEP_ID]: 'step-abc' },
        }),
      ).toBe(false)
    })
  })
})
