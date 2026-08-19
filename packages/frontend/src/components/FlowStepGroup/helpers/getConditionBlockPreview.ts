import type { IConditionRow, IJSONObject, IMultiRowGroup } from '@plumber/types'

export type ConditionPreviewPart =
  | { type: 'text'; text: string }
  | { type: 'variable'; id: string; label: string }
  /** Bold non-variable word (e.g. "item" in "For every item in …"). */
  | { type: 'emphasis'; text: string }

const EMPTY_CONDITION_PREVIEW: ConditionPreviewPart[] = [
  { type: 'text', text: 'Specify condition' },
]

const EMPTY_FOR_EACH_PREVIEW: ConditionPreviewPart[] = [
  { type: 'text', text: 'Specify list' },
]

const STEP_VARIABLE_GLOBAL_REGEX =
  /\{\{step\.[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.([^}|]+)(?:\|[^}]+)?\}\}/gi

/**
 * The verb phrase for each condition operator, in both polarities. Both forms
 * are spelled out rather than derived by prefixing "is not", since not every
 * operator takes that prefix — "contains" negates to "does not contain", not
 * "is not contains".
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
 */
export function getConditionBlockPreviewParts(
  parameters: IJSONObject | undefined,
): ConditionPreviewPart[] {
  const groups = parameters?.conditions as
    | IMultiRowGroup<IConditionRow>[]
    | undefined

  if (!Array.isArray(groups) || groups.length === 0) {
    return EMPTY_CONDITION_PREVIEW
  }

  for (const group of groups) {
    for (const row of group.rows ?? []) {
      const parts = formatConditionRow(row)
      if (parts.length > 0) {
        return parts
      }
    }
  }

  return EMPTY_CONDITION_PREVIEW
}

export function getForEachBlockPreviewParts(
  parameters: IJSONObject | undefined,
): ConditionPreviewPart[] {
  const items = parameters?.items
  if (typeof items !== 'string' || items.trim().length === 0) {
    return EMPTY_FOR_EACH_PREVIEW
  }

  const itemParts = valueToParts(items.trim())
  if (itemParts.length === 0) {
    return EMPTY_FOR_EACH_PREVIEW
  }

  // Paper 2ZC: "For every item in {list}" — "item" and the list name are bold.
  return [
    { type: 'text', text: 'For every ' },
    { type: 'emphasis', text: 'item' },
    { type: 'text', text: ' in ' },
    ...itemParts,
  ]
}

function formatConditionRow(
  row: Partial<IConditionRow>,
): ConditionPreviewPart[] {
  const fieldParts = valueToParts(stringifyValue(row.field))
  const isNegated = row.is === 'not'
  const operatorKey = row.condition
  const operatorPhrase = getOperatorPhrase(operatorKey, isNegated)
  // "empty" is the one operator with nothing to compare against, so any value
  // left over in the row from a previous operator choice is not shown.
  const valueParts =
    operatorKey === 'empty' ? [] : valueToParts(stringifyValue(row.text))

  if (fieldParts.length === 0 && !operatorPhrase && valueParts.length === 0) {
    return []
  }

  const parts: ConditionPreviewPart[] = [...fieldParts]

  if (operatorPhrase) {
    // Leading space when a field pill/text precedes the phrase.
    parts.push({
      type: 'text',
      text: fieldParts.length > 0 ? ` ${operatorPhrase}` : operatorPhrase,
    })
  }

  if (valueParts.length > 0) {
    // Space before the value when the field/phrase already rendered.
    if (operatorPhrase || fieldParts.length > 0) {
      parts.push({ type: 'text', text: ' ' })
    }
    parts.push(...valueParts)
  }

  return parts
}

/**
 * Splits raw parameter text into plain text and variable parts. Step UUIDs
 * are dropped from the label (last path segment only).
 */
function valueToParts(raw: string): ConditionPreviewPart[] {
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
      parts.push({ type: 'text', text: raw.slice(lastIndex, index) })
    }

    const segments = path.split('.').filter(Boolean)
    const label = segments[segments.length - 1] ?? path
    // Strip surrounding {{ }} for the lookup id used by stepsWithVars.
    const id = full.slice(2, -2).split('|')[0]

    parts.push({ type: 'variable', id, label })
    lastIndex = index + full.length
  }

  if (lastIndex < raw.length) {
    parts.push({ type: 'text', text: raw.slice(lastIndex) })
  }

  // Plain (non-variable) values still show as text.
  if (parts.length === 0 && raw.trim()) {
    parts.push({ type: 'text', text: raw.trim() })
  }

  return parts
}

/**
 * An unmapped operator key still previews, spelled out as-is behind "is" — a
 * new backend operator shows up in the header as something readable rather
 * than vanishing from the sentence.
 */
function getOperatorPhrase(
  operatorKey: string | undefined,
  isNegated: boolean,
): string {
  if (!operatorKey) {
    return ''
  }

  const phrases = OPERATOR_PHRASES[operatorKey]
  if (phrases) {
    return isNegated ? phrases.negative : phrases.affirmative
  }

  return isNegated ? `is not ${operatorKey}` : `is ${operatorKey}`
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}
