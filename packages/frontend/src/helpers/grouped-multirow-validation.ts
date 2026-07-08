import type { IField, IJSONObject, IJSONValue } from '@plumber/types'

import { isFieldHidden } from '@/helpers/isFieldHidden'

// `false` and 0 are valid values; only null, undefined and '' are invalid.
function isValidArgValue(value: IJSONValue): boolean {
  return value != null && value !== ''
}

/**
 * A row is complete when every required subfield has a value, skipping subfields
 * that are hidden in that row (e.g. the value field for the unary `empty`
 * operator, via its `hiddenIf`).
 */
export function isRowComplete(row: IJSONObject, subFields: IField[]): boolean {
  for (const subField of subFields) {
    // required is true by default, so strict-compare against false.
    if (subField.required === false) {
      continue
    }
    if (isFieldHidden(subField.hiddenIf, row)) {
      continue
    }
    if (!isValidArgValue(row[subField.key])) {
      return false
    }
  }
  return true
}

/**
 * A flat list of AND-rows is complete when it is non-empty and every row is
 * complete.
 */
export function areRowsComplete(
  rows: IJSONObject[],
  subFields: IField[],
): boolean {
  if (rows.length === 0) {
    return false
  }
  return rows.every((row) => isRowComplete(row, subFields))
}

/**
 * A grouped-multirow value is complete when there is at least one group and
 * every group is non-empty with all of its rows complete. This enforces the
 * "every OR-group needs >=1 complete row" rule and avoids the vacuous-true
 * `[].every() === true` footgun.
 */
export function isGroupedMultiRowComplete(
  groups: { rows?: IJSONObject[] }[],
  subFields: IField[],
): boolean {
  if (!Array.isArray(groups) || groups.length === 0) {
    return false
  }
  return groups.every((group) =>
    areRowsComplete((group?.rows ?? []) as IJSONObject[], subFields),
  )
}
