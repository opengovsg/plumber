import { describe, expect, it, vi } from 'vitest'

import { buildConditionSentence } from '../buildConditionSentence'
import type { ConditionPreviewPart } from '../getConditionBlockPreview'
import { MAX_CONDITION_LABEL_LENGTH } from '../truncateConditionLabel'

const LONG = 'A'.repeat(MAX_CONDITION_LABEL_LENGTH + 10)

const leadingVar = (id: string, label: string): ConditionPreviewPart => ({
  type: 'variable',
  id,
  label,
  position: 'leading',
})

const trailingVar = (id: string, label: string): ConditionPreviewPart => ({
  type: 'variable',
  id,
  label,
  position: 'trailing',
})

const never = () => undefined

describe('buildConditionSentence', () => {
  it('resolves a variable to its real label, not its path segment', () => {
    const resolve = vi.fn().mockReturnValue('2. What is your full name?')

    const { parts } = buildConditionSentence(
      'IF',
      [leadingVar('step.abc.fields.6483.answer', 'answer')],
      resolve,
    )

    expect(resolve).toHaveBeenCalledWith('step.abc.fields.6483.answer')
    // Long enough to be cut, but it is the resolved label being cut, not
    // "answer" — which is the whole point of the lookup.
    expect(parts[0].display.startsWith('2. What is your')).toBe(true)
  })

  it('falls back to the path segment when nothing resolves', () => {
    const { parts } = buildConditionSentence(
      'IF',
      [leadingVar('step.abc.row.a3f1', 'a3f1')],
      never,
    )

    expect(parts[0].display).toBe('a3f1')
  })

  it('caps a leading part and reports it', () => {
    const { parts, isLeadingTruncated } = buildConditionSentence(
      'IF',
      [leadingVar('step.abc.x', LONG)],
      never,
    )

    expect(isLeadingTruncated).toBe(true)
    expect(parts[0].display).toHaveLength(MAX_CONDITION_LABEL_LENGTH)
    expect(parts[0].display.endsWith('…')).toBe(true)
  })

  it('lets a trailing part run on, so layout can clip it', () => {
    const { parts, isLeadingTruncated } = buildConditionSentence(
      'IF',
      [trailingVar('step.abc.x', LONG)],
      never,
    )

    expect(parts[0].display).toBe(LONG)
    expect(isLeadingTruncated).toBe(false)
  })

  it('caps a typed leading value but not a typed trailing one', () => {
    const { parts } = buildConditionSentence(
      'IF',
      [
        { type: 'literal', text: LONG, position: 'leading' },
        { type: 'literal', text: LONG, position: 'trailing' },
      ],
      never,
    )

    expect(parts[0].display).toHaveLength(MAX_CONDITION_LABEL_LENGTH)
    expect(parts[1].display).toBe(LONG)
  })

  it('never truncates connectives or the emphasised keyword', () => {
    const { parts, isLeadingTruncated } = buildConditionSentence(
      'REPEAT',
      [
        { type: 'text', text: LONG },
        { type: 'emphasis', text: LONG },
      ],
      never,
    )

    expect(parts[0].display).toBe(LONG)
    expect(parts[1].display).toBe(LONG)
    expect(isLeadingTruncated).toBe(false)
  })

  it('builds the tooltip sentence from untruncated text, badge first', () => {
    const { fullSentence } = buildConditionSentence(
      'IF',
      [
        leadingVar('step.abc.x', LONG),
        { type: 'text', text: ' is equal to ' },
        { type: 'literal', text: 'Yes', position: 'trailing' },
      ],
      never,
    )

    expect(fullSentence).toBe(`IF ${LONG} is equal to Yes`)
  })

  it('uses the resolved label in the tooltip too', () => {
    const { fullSentence } = buildConditionSentence(
      'IF',
      [leadingVar('step.abc.row.a3f1', 'a3f1')],
      () => 'Status',
    )

    expect(fullSentence).toBe('IF Status')
  })
})
