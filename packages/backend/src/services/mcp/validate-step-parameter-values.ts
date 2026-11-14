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
  if (typeof value !== 'string' || /<img\b/i.test(value)) {
    return false
  }
  // Only checks for visible text. The result is never stored or rendered.
  const text = value
    .split(/<[^>]*>/)
    .join(' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
  return isBlankString(text)
}

// Mirrors the editor's isFieldHidden. A hidden field is never asked for, such
// as a Tiles filter value when the operator is "Is empty".
function isFieldHidden(field: IField, siblings: Record<string, unknown>) {
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
    case 'is_empty': {
      const sibling = get(siblings, condition.fieldKey)
      return typeof sibling === 'string'
        ? !sibling
        : sibling === null || sibling === undefined
    }
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

/**
 * Finds the first incoming parameter the model should have asked about
 * instead of saving. Only keys present in `parameters` are checked, because
 * the model saves a step across several calls.
 */
export function findEmptyParameterError(
  fields: IField[],
  parameters: Record<string, unknown>,
  savedParameters: Record<string, unknown> = {},
): string | null {
  const siblings = { ...savedParameters, ...parameters }
  for (const field of fields) {
    if (!(field.key in parameters) || isFieldHidden(field, siblings)) {
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

    if (
      (field.type === 'multirow-multicol' || field.type === 'multirow') &&
      Array.isArray(value)
    ) {
      for (const [index, row] of value.entries()) {
        const rowError = isRow(row)
          ? findEmptyParameterError(field.subFields, row)
          : null
        if (rowError) {
          return `${label}, row ${index + 1}: ${rowError}`
        }
      }
    }
  }
  return null
}
