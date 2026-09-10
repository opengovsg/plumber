import type { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import {
  FOR_EACH_INSIDE_BLOCK_REASON,
  getIfThenV2Selectability,
  IF_THEN_INSIDE_BLOCK_REASON,
  LAST_STEP_ONLY_REASON,
} from '../useIsAppSelectable'

//
// Fixtures. Selectability runs over the MRF-filtered action-step list (the
// trigger already removed), ordered by position, so these never include a
// trigger.
//

const plain = (id: string): IStep =>
  ({ id, appKey: 'postman', key: 'sendTransactionalEmail' }) as IStep

// The endStepId marker is what makes an if-then V2, so every block here
// carries one. A marker pointing at the if-then itself is an empty block.
const ifThen = (id: string, endStepId: string): IStep => {
  const marker: Partial<IStep> = { config: { endStepId } }
  return {
    id,
    appKey: 'toolbox',
    key: 'ifThen',
    parameters: { depth: '0' },
    ...marker,
  } as IStep
}

const forEach = (id: string): IStep =>
  ({ id, appKey: 'toolbox', key: 'forEach' }) as IStep

const GROUPING_ACTIONS = new Set(['toolbox-ifThen', 'toolbox-forEach'])

describe('getIfThenV2Selectability', () => {
  describe('inside an if-then block', () => {
    it('rejects both grouping actions when the launcher states the placement', () => {
      // The empty-block placeholder's anchor is the if-then step itself, which
      // is not inside its own block, so it can only say so explicitly.
      const emptyBlock = ifThen('ifThen', 'ifThen')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorPlacement: 'inside-if-then-block',
        anchorStep: emptyBlock,
        actionSteps: [emptyBlock],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result[TOOLBOX_ACTIONS.ForEach]).toEqual({
        isSelectable: false,
        disabledReason: FOR_EACH_INSIDE_BLOCK_REASON,
      })
      expect(result[TOOLBOX_ACTIONS.IfThen]).toEqual({
        isSelectable: false,
        disabledReason: IF_THEN_INSIDE_BLOCK_REASON,
      })
    })

    it('rejects both grouping actions when the anchor is a block child', () => {
      const child = plain('child')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorStep: child,
        actionSteps: [ifThen('ifThen', 'child'), child],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result[TOOLBOX_ACTIONS.ForEach].isSelectable).toBe(false)
      expect(result[TOOLBOX_ACTIONS.IfThen].isSelectable).toBe(false)
    })
  })

  describe('outside every if-then block', () => {
    it('allows both grouping actions after the last block, at the last step', () => {
      const child = plain('child')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorPlacement: 'after-if-then-block',
        anchorStep: child,
        actionSteps: [ifThen('ifThen', 'child'), child],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result[TOOLBOX_ACTIONS.ForEach].isSelectable).toBe(true)
      expect(result[TOOLBOX_ACTIONS.IfThen].isSelectable).toBe(true)
    })

    it('holds for-each to the last step while an if-then goes anywhere', () => {
      const child = plain('child')

      const result = getIfThenV2Selectability({
        isLastStep: false,
        anchorPlacement: 'after-if-then-block',
        anchorStep: child,
        actionSteps: [ifThen('ifThen', 'child'), child, plain('after')],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result[TOOLBOX_ACTIONS.ForEach]).toEqual({
        isSelectable: false,
        disabledReason: LAST_STEP_ONLY_REASON,
      })
      expect(result[TOOLBOX_ACTIONS.IfThen].isSelectable).toBe(true)
    })

    it('rejects a second for-each in the flow', () => {
      const inBody = plain('inBody')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorStep: inBody,
        actionSteps: [forEach('forEach'), inBody],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result[TOOLBOX_ACTIONS.ForEach]).toEqual({
        isSelectable: false,
        disabledReason: LAST_STEP_ONLY_REASON,
      })
    })
  })

  describe('delay', () => {
    it('rejects a delay inside a for-each body', () => {
      const inBody = plain('inBody')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorStep: inBody,
        actionSteps: [forEach('forEach'), inBody],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result.delay.isSelectable).toBe(false)
    })

    it('allows a delay inside an if-then block', () => {
      const child = plain('child')

      const result = getIfThenV2Selectability({
        isLastStep: true,
        anchorPlacement: 'inside-if-then-block',
        anchorStep: child,
        actionSteps: [ifThen('ifThen', 'child'), child],
        groupingActions: GROUPING_ACTIONS,
      })

      expect(result.delay.isSelectable).toBe(true)
    })
  })
})
