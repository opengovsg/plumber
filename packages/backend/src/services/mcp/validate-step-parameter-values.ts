import type { IField } from '@plumber/types'
import get from 'lodash/get'

import { UserFacingError } from '@/errors/user-facing-error'

export const NO_PARAMETER_VALUES_MESSAGE =
  'No parameter values were given, so nothing was saved. If the user declined every column, skip this call and test the step.'

export class InvalidStepParametersError extends UserFacingError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidStepParametersError'
  }
}

// Whole-value tokens the model writes when it has no real value, e.g.
// "<recipient email>", "[TBD]" or "TODO". Real values can look similar: a
// "[For Action]" subject or an "<officer@agency.gov.sg>" recipient.
const PLACEHOLDER_PATTERNS = [
  /^<[^>@]*>$/,
  /^\[\s*(tbd|todo|n\/a|placeholder)\s*\]$/i,
  /^(tbd|todo|n\/a|placeholder)$/i,
]

function isBlankString(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }
  if (typeof value !== 'string') {
    return false
  }
  const trimmed = value.trim()
  return (
    trimmed === '' ||
    PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
  )
}

function hasNoValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isBlankString)
  }
  return isBlankString(value)
}

// The editor stores an empty body as markup such as "<p></p>". An image
// alone is still a body.
function isEmptyRichText(value: unknown): boolean {
  if (typeof value !== 'string') {
    return true
  }
  if (/<img\b/i.test(value)) {
    return false
  }
  // Only checks for visible text. The result is never stored or rendered.
  const text = value
    .split(/<[^>]*>/)
    .join(' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
  return isBlankString(text)
}

// Mirrors the editor's isFieldHidden, so a Tiles filter value with operator
// "Is empty" is skipped. IMPORTANT: a field hidden until a sibling is filled
// (op is_empty) is still checked, because its value is saved and used later.
function isFieldNotApplicable(
  field: IField,
  siblings: Record<string, unknown>,
): boolean {
  const condition = field.hiddenIf
  if (!condition) {
    return false
  }
  switch (condition.op) {
    case 'always_true':
      return true
    case 'equals':
      return get(siblings, condition.fieldKey) === condition.fieldValue
    case 'not_equals':
      return get(siblings, condition.fieldKey) !== condition.fieldValue
    case 'is_empty':
      return false
    case 'in':
      return condition.fieldValues.includes(get(siblings, condition.fieldKey))
    case 'not_in':
      return !condition.fieldValues.includes(get(siblings, condition.fieldKey))
  }
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmptyCollection(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 0
  )
}

function findRowError(
  subFields: IField[],
  rows: unknown,
  label: string,
): string | null {
  if (!Array.isArray(rows)) {
    return null
  }
  for (const [index, row] of rows.entries()) {
    const rowError = isRow(row)
      ? findEmptyParameterError(subFields, row, {}, { requireAllFields: true })
      : null
    if (rowError) {
      return `${label}, row ${index + 1}: ${rowError}`
    }
  }
  return null
}

/**
 * Finds the first incoming parameter the model should have asked about
 * instead of saving. Top-level keys absent from `parameters` are skipped,
 * because the model saves a step across several calls. A row has no partial
 * save, so a missing required cell in a row counts as empty.
 */
export function findEmptyParameterError(
  fields: IField[],
  parameters: Record<string, unknown>,
  savedParameters: Record<string, unknown> = {},
  { requireAllFields = false }: { requireAllFields?: boolean } = {},
): string | null {
  const siblings = { ...savedParameters, ...parameters }
  for (const field of fields) {
    if (
      (!requireAllFields && !(field.key in parameters)) ||
      isFieldNotApplicable(field, siblings)
    ) {
      continue
    }
    const value = parameters[field.key]
    const label = field.label ?? field.key

    // list_columns tells the model to replace a saved non-array with [].
    const isRepair =
      field.type === 'multirow-multicol' &&
      Array.isArray(value) &&
      value.length === 0 &&
      savedParameters[field.key] !== undefined &&
      !Array.isArray(savedParameters[field.key])
    if (isRepair) {
      continue
    }

    if (
      field.type === 'multirow-multicol' &&
      field.required &&
      isEmptyCollection(value)
    ) {
      return `${label} is empty. Collect the column values, or leave the field out of the call and test the step. Nothing was saved.`
    }

    if (
      field.required &&
      (field.type === 'rich-text' ? isEmptyRichText(value) : hasNoValue(value))
    ) {
      return `${label} has no value yet. Ask the user for it before saving. Nothing was saved.`
    }

    if (field.type === 'multirow-multicol' || field.type === 'multirow') {
      const rowError = findRowError(field.subFields, value, label)
      if (rowError) {
        return rowError
      }
    }

    if (field.type === 'grouped-multirow' && Array.isArray(value)) {
      for (const [index, group] of value.entries()) {
        const groupError = isRow(group)
          ? findRowError(
              field.subFields,
              group.rows,
              `${label}, group ${index + 1}`,
            )
          : null
        if (groupError) {
          return groupError
        }
      }
    }
  }
  return null
}
