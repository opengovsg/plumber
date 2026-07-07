import type { IMultiRowGroup } from '@plumber/types'

/**
 * Collapses a flat list of rows (a legacy AND-list) into a **single** group,
 * preserving AND semantics. Reusable by any app migrating a flat multirow field
 * to the grouped `grouped-multirow` shape.
 *
 * Critically, this produces **exactly one** group — never one-group-per-row,
 * which would flip AND → OR and silently break existing pipes. This is the
 * single source of truth for the old → new collapse; the evaluator and frontend
 * do not duplicate it.
 */
export function wrapRowsIntoSingleGroup<T>(rows: T[]): IMultiRowGroup<T>[] {
  return [{ rows }]
}
