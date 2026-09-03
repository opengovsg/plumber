import type { IJSONObject } from '@plumber/types'

import { z } from 'zod'

/**
 * Where a part sits in the sentence, which decides whether it may spill.
 *
 * IMPORTANT: only `leading` parts are length-capped, since the block's own
 * width clips a `trailing` part.
 */
export type ConditionSentencePosition = 'leading' | 'trailing'

export type ConditionPreviewPart =
  /** Sentence connective, never cut, since a clipped operator loses meaning. */
  | { type: 'text'; text: string }
  | { type: 'literal'; text: string; position: ConditionSentencePosition }
  | {
      type: 'variable'
      id: string
      label: string
      position: ConditionSentencePosition
    }
  | { type: 'emphasis'; text: string }

const EMPTY_CONDITION_PREVIEW: ConditionPreviewPart[] = [
  { type: 'text', text: 'Specify condition' },
]

const EMPTY_FOR_EACH_PREVIEW: ConditionPreviewPart[] = [
  { type: 'text', text: 'Specify list' },
]

const MULTIPLE_CONDITIONS_PREVIEW: ConditionPreviewPart[] = [
  { type: 'text', text: 'Multiple conditions' },
]

// Not `GLOBAL_VARIABLE_REGEX` from RichTextEditor/utils.ts, which captures the
// whole match rather than the path segment.
const STEP_VARIABLE_GLOBAL_REGEX =
  /\{\{step\.[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.([^}|]+)(?:\|[^}]+)?\}\}/gi

/**
 * Lenient read of the parameters a half-configured step holds.
 *
 * IMPORTANT: every field falls back instead of throwing, so a malformed
 * parameter previews as the placeholder rather than breaking the editor.
 */
const previewTextSchema = z
  .union([z.string(), z.number(), z.boolean()])
  .transform(String)
  .catch('')

const conditionRowSchema = z.object({
  field: previewTextSchema,
  is: previewTextSchema,
  condition: previewTextSchema,
  text: previewTextSchema,
})

const conditionGroupsSchema = z
  .array(
    z
      .object({ rows: z.array(conditionRowSchema).catch([]) })
      .catch({ rows: [] }),
  )
  .catch([])

const forEachItemsSchema = z.string().catch('')

type ConditionRowPreview = z.infer<typeof conditionRowSchema>

/**
 * The verb phrase for each condition operator, re-spelling the option labels in
 * the backend's `get-condition-args.ts`, which the header cannot read.
 *
 * IMPORTANT: both polarities are spelled out, since "contains" negates to
 * "does not contain", not "is not contains".
 */
const OPERATOR_PHRASES: Record<
  string,
  { affirmative: string; negative: string }
> = {
  equals: { affirmative: 'is equal to', negative: 'is not equal to' },
  empty: { affirmative: 'is empty', negative: 'is not empty' },
  contains: { affirmative: 'contains', negative: 'does not contain' },
  begins: { affirmative: 'begins with', negative: 'does not begin with' },
  gt: { affirmative: 'is greater than', negative: 'is not greater than' },
  gte: {
    affirmative: 'is greater than or equal to',
    negative: 'is not greater than or equal to',
  },
  lt: { affirmative: 'is less than', negative: 'is not less than' },
  lte: {
    affirmative: 'is less than or equal to',
    negative: 'is not less than or equal to',
  },
  before: { affirmative: 'is before', negative: 'is not before' },
  after: { affirmative: 'is after', negative: 'is not after' },
}

/**
 * Structured preview of a toolbox condition step for the block header.
 * Variables are separate parts so the header can bold / truncate them.
 *
 * IMPORTANT: one condition reads as a sentence, several collapse to a label,
 * since a sentence describing only the first would misstate the step.
 */
export function getConditionBlockPreviewParts(
  parameters: IJSONObject | undefined,
): ConditionPreviewPart[] {
  const groups = conditionGroupsSchema.parse(parameters?.conditions)
  let firstRowParts: ConditionPreviewPart[] | undefined

  for (const group of groups) {
    for (const row of group.rows) {
      const parts = formatConditionRow(row)
      if (parts.length === 0) {
        continue
      }

      if (firstRowParts) {
        return MULTIPLE_CONDITIONS_PREVIEW
      }

      firstRowParts = parts
    }
  }

  return firstRowParts ?? EMPTY_CONDITION_PREVIEW
}

export function getForEachBlockPreviewParts(
  parameters: IJSONObject | undefined,
): ConditionPreviewPart[] {
  const items = forEachItemsSchema.parse(parameters?.items).trim()
  if (items.length === 0) {
    return EMPTY_FOR_EACH_PREVIEW
  }

  const itemParts = valueToParts(items, 'trailing')
  if (itemParts.length === 0) {
    return EMPTY_FOR_EACH_PREVIEW
  }

  // "item" is emphasised alongside the list name, though it is not a variable.
  return [
    { type: 'text', text: 'For every ' },
    { type: 'emphasis', text: 'item' },
    { type: 'text', text: ' in ' },
    ...itemParts,
  ]
}

function formatConditionRow(row: ConditionRowPreview): ConditionPreviewPart[] {
  const fieldParts = valueToParts(row.field, 'leading')
  const isNegated = row.is === 'not'
  const operatorKey = row.condition
  const operatorPhrase = getOperatorPhrase(operatorKey, isNegated)
  // "empty" is the one operator with nothing to compare against, so any value
  // left over in the row from a previous operator choice is not shown.
  const valueParts =
    operatorKey === 'empty' ? [] : valueToParts(row.text, 'trailing')

  if (fieldParts.length === 0 && !operatorPhrase && valueParts.length === 0) {
    return []
  }

  const parts: ConditionPreviewPart[] = [...fieldParts]

  if (operatorPhrase) {
    parts.push({
      type: 'text',
      text: fieldParts.length > 0 ? ` ${operatorPhrase}` : operatorPhrase,
    })
  }

  if (valueParts.length > 0) {
    if (operatorPhrase || fieldParts.length > 0) {
      parts.push({ type: 'text', text: ' ' })
    }
    parts.push(...valueParts)
  }

  return parts
}

/** Splits user-typed parameter text into `literal` and `variable` parts. */
function valueToParts(
  raw: string,
  position: ConditionSentencePosition,
): ConditionPreviewPart[] {
  if (!raw) {
    return []
  }

  const parts: ConditionPreviewPart[] = []
  let lastIndex = 0

  for (const match of raw.matchAll(STEP_VARIABLE_GLOBAL_REGEX)) {
    const full = match[0]
    const path = match[1]
    const index = match.index ?? 0

    if (index > lastIndex) {
      parts.push({
        type: 'literal',
        text: raw.slice(lastIndex, index),
        position,
      })
    }

    const segments = path.split('.').filter(Boolean)
    const label = segments[segments.length - 1] ?? path
    // varInfoMap is keyed without the surrounding {{ }}.
    const id = full.slice(2, -2).split('|')[0]

    parts.push({ type: 'variable', id, label, position })
    lastIndex = index + full.length
  }

  if (lastIndex < raw.length) {
    parts.push({ type: 'literal', text: raw.slice(lastIndex), position })
  }

  if (parts.length === 0 && raw.trim()) {
    parts.push({ type: 'literal', text: raw.trim(), position })
  }

  return parts
}

/**
 * Spells an unmapped operator behind "is", so a new backend operator still
 * previews instead of vanishing.
 */
function getOperatorPhrase(operatorKey: string, isNegated: boolean): string {
  if (!operatorKey) {
    return ''
  }

  const phrases = OPERATOR_PHRASES[operatorKey]
  if (phrases) {
    return isNegated ? phrases.negative : phrases.affirmative
  }

  return isNegated ? `is not ${operatorKey}` : `is ${operatorKey}`
}
