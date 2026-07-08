import type { IJSONObject, IMultiRowGroup } from '@plumber/types'

/**
 * Pure, framework-free logic for the GroupedMultiRow builder. Extracted so the
 * empty-state guard and caps can be unit tested without rendering React (the
 * frontend has no component test harness).
 */

/**
 * Empty-state guard: a grouped-multirow always renders at least one group so the
 * builder never shows an empty/crashed state. Missing, non-array, or empty
 * values normalize to a single empty group.
 */
export function normalizeGroupsValue(
  value: unknown,
): IMultiRowGroup<IJSONObject>[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ rows: [] }]
  }
  return value as IMultiRowGroup<IJSONObject>[]
}

/**
 * Whether another OR-group may be added. `+ Or` is disabled at the cap.
 */
export function canAddGroup(numGroups: number, maxGroups?: number): boolean {
  if (maxGroups == null) {
    return true
  }
  return numGroups < maxGroups
}

/**
 * Whether another AND-row may be added to a group. `+ And` is disabled at the
 * cap. (The reused MultiRow enforces this via its `maxRows` prop; this mirrors
 * the rule for testing.)
 */
export function canAddRow(numRows: number, maxRowsPerGroup?: number): boolean {
  if (maxRowsPerGroup == null) {
    return true
  }
  return numRows < maxRowsPerGroup
}
