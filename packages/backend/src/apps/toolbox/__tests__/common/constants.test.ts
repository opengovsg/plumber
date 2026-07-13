import { describe, expect, it } from 'vitest'

import {
  IF_THEN_END_STEP_ID_PARAM,
  isIfThenStep,
  isNewStyleIfThen,
  TOOLBOX_ACTIONS,
} from '../../common/constants'

describe('toolbox constants', () => {
  it('exposes the only-continue-if action key', () => {
    expect(TOOLBOX_ACTIONS.ONLY_CONTINUE_IF).toBe('onlyContinueIf')
  })

  it('exposes the endStepId parameter key', () => {
    expect(IF_THEN_END_STEP_ID_PARAM).toBe('endStepId')
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
    it('is true when an if-then carries the endStepId key', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { [IF_THEN_END_STEP_ID_PARAM]: 'step-abc' },
        }),
      ).toBe(true)
    })

    it('is true when endStepId is a self-reference (empty-block marker)', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { [IF_THEN_END_STEP_ID_PARAM]: 'own-id' },
        }),
      ).toBe(true)
    })

    it('checks own-key presence, not value (present-but-undefined counts)', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { [IF_THEN_END_STEP_ID_PARAM]: undefined },
        }),
      ).toBe(true)
    })

    it('is false for a legacy if-then without the endStepId key', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'ifThen',
          parameters: { depth: 0 },
        }),
      ).toBe(false)
    })

    it('is false when parameters is missing', () => {
      expect(isNewStyleIfThen({ appKey: 'toolbox', key: 'ifThen' })).toBe(false)
    })

    it('is false for a non-if-then step even if it carries endStepId', () => {
      expect(
        isNewStyleIfThen({
          appKey: 'toolbox',
          key: 'onlyContinueIf',
          parameters: { [IF_THEN_END_STEP_ID_PARAM]: 'step-abc' },
        }),
      ).toBe(false)
    })
  })
})
