import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

/**
 * Returns a copy of `subF` with `placeholder` overridden by the sibling row
 * value at the conventional `${subF.key}Hint` key, if it exists and is a
 * non-empty string. Returns the original `subF` reference unchanged otherwise.
 */
export function applyDynamicPlaceholder(
  subF: IFieldMultiRowMultiColSubField,
  rowValues: Record<string, unknown> | undefined,
): IFieldMultiRowMultiColSubField {
  const hint = rowValues?.[`${subF.key}Hint`]
  if (typeof hint === 'string' && hint) {
    return { ...subF, placeholder: hint }
  }
  return subF
}
