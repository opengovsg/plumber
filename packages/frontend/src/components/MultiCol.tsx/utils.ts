import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

/**
 * Returns a copy of `subF` with `placeholder` overridden by the sibling row
 * value at `subF.dynamicPlaceholderKey`, if it exists and is a non-empty
 * string. Returns the original `subF` reference unchanged otherwise.
 */
export function applyDynamicPlaceholder(
  subF: IFieldMultiRowMultiColSubField,
  rowValues: Record<string, unknown> | undefined,
): IFieldMultiRowMultiColSubField {
  if (!subF.dynamicPlaceholderKey) {
    return subF
  }
  const hint = rowValues?.[subF.dynamicPlaceholderKey]
  if (typeof hint === 'string' && hint) {
    return { ...subF, placeholder: hint }
  }
  return subF
}
