import type { IField } from '@plumber/types'

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
// "<recipient email>", "[TBD]" or "TODO". A {{step...}} reference is a value.
const PLACEHOLDER_PATTERNS = [
  /^<[^>]*>$/,
  /^\[[^\]]*\]$/,
  /^(tbd|todo|n\/a|placeholder)$/i,
]

function isBlankString(value: unknown): boolean {
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
): string | null {
  for (const field of fields) {
    if (!(field.key in parameters)) {
      continue
    }
    const value = parameters[field.key]
    const label = field.label ?? field.key

    if (field.type === 'multirow-multicol' && isEmptyCollection(value)) {
      return `${label} is empty. Collect the column values, or leave the field out of the call and test the step. Nothing was saved.`
    }

    if (field.required && hasNoValue(value)) {
      return `${label} has no value yet. Ask the user for it before saving. Nothing was saved.`
    }
  }
  return null
}
