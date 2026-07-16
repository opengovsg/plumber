import { describe, expect, it } from 'vitest'

import {
  IF_THEN_END_STEP_ID_CONFIG_KEY,
  isIfThenStep,
  isNewStyleIfThen,
  TOOLBOX_ACTIONS,
} from '../../common/constants'

describe('toolbox constants', () => {
  it('exposes the only-continue-if action key', () => {
    expect(TOOLBOX_ACTIONS.ONLY_CONTINUE_IF).toBe('onlyContinueIf')
  })

  it('exposes the endStepId config key', () => {
    expect(IF_THEN_END_STEP_ID_CONFIG_KEY).toBe('endStepId')
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

  describe('isNewStyleIfThen', () => {
    it('is true when an if-then carries the endStepId config key', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [IF_THEN_END_STEP_ID_CONFIG_KEY]: 'step-abc' },
        }),
      ).toBe(true)
    })

    it('is true when endStepId is a self-reference (empty-block marker)', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [IF_THEN_END_STEP_ID_CONFIG_KEY]: 'own-id' },
        }),
      ).toBe(true)
    })

    it('checks own-key presence, not value (present-but-undefined counts)', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { [IF_THEN_END_STEP_ID_CONFIG_KEY]: undefined },
        }),
      ).toBe(true)
    })

    it('is false for a legacy if-then without the endStepId config key', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          config: { stepName: 'legacy branch' },
        }),
      ).toBe(false)
    })

    it('ignores endStepId in parameters (config-only marker)', () => {
      // A real Step carries both parameters and config; the marker only counts
      // when it lives in config (cast because IfThenStepLike omits parameters).
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { [IF_THEN_END_STEP_ID_CONFIG_KEY]: 'step-abc' },
          config: {},
        } as any),
      ).toBe(false)
    })

    it('is false when config is missing', () => {
      expect(isNewStyleIfThen({ appKey: 'toolbox', key: 'ifThen' })).toBe(false)
    })

    it('is false for a non-if-then step even if it carries endStepId', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          config: { [IF_THEN_END_STEP_ID_CONFIG_KEY]: 'step-abc' },
        }),
      ).toBe(false)
    })
  })
})
