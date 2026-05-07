import type { IJSONObject } from '@plumber/types'

import { createVersionedStepTransformer } from '@/helpers/transform-step-parameters'

const ACTION_TRANSFORMERS: Record<
  string,
  ((parameters: IJSONObject) => IJSONObject)[]
> = {
  getTableRow: [transformLookupConditionsToFilters],
  getTableRows: [transformLookupConditionsToFilters],
  updateTableRow: [transformLookupConditionsToFilters],
}

/**
 * Transforms old lookup parameters to new filters array format.
 * Idempotent and safe to call multiple times.
 *
 * Handles three cases:
 * 1. Database has old params only → transforms to filters, removes old params
 * 2. Database has both formats (legacy) → keeps filters, removes old params
 * 3. Database has new format only → returns clean data
 *
 * Example transformation:
 * Input:  { lookupColumn: 'Email', lookupValue: 'test@example.com' }
 * Output: { filters: [{ lookupColumn: 'Email', lookupValue: 'test@example.com' }] }
 */
export function transformLookupConditionsToFilters(
  parameters: IJSONObject,
): IJSONObject {
  const { lookupColumn, lookupValue, filters, ...rest } = parameters

  // If filters already populated, use them (remove old params)
  if (filters && Array.isArray(filters) && filters.length > 0) {
    return {
      ...rest,
      filters,
    }
  }

  // Transform old parameters to filters format
  if (lookupColumn || lookupValue !== undefined) {
    return {
      ...rest,
      filters: [
        {
          lookupColumn,
          lookupValue: lookupValue ?? '',
        },
      ],
    }
  }

  // No transformation needed
  return parameters
}

export const stepTransformer =
  createVersionedStepTransformer(ACTION_TRANSFORMERS)
