import type { IField } from '@plumber/types'

import { getDynamicDropdownSource } from './dynamicFieldOptions'
import {
  type FieldWithOptions,
  resolveOptionLabel,
} from './resolveFieldDisplayValue'

interface ColumnValueFieldShape {
  columnKey: string
  valueKey: string
  columnField: FieldWithOptions
  valueField: FieldWithOptions
}

// A multirow/multirow-multicol field reads as a "Column | Value" table when
// it has exactly two subFields and one of them is a dynamic dropdown (e.g.
// Tile's columnId, Excel's columnName, LetterSG's field) — i.e. a per-row
// pick-a-column selector paired with a value. This deliberately excludes
// fields with a third subField (Tile/Excel's filters: column+operator+value)
// and fields where the "key" subField is a plain string (PaySG metadata,
// custom-api headers), since those aren't a dynamic column picker.
function getColumnValueFieldShape(
  field: IField | undefined,
): ColumnValueFieldShape | null {
  const subFields = (field as { subFields?: IField[] } | undefined)?.subFields
  if (!subFields || subFields.length !== 2) {
    return null
  }

  const dynamicIndex = subFields.findIndex(
    (f) => getDynamicDropdownSource(f) !== null,
  )
  if (dynamicIndex === -1) {
    return null
  }

  const columnField = subFields[dynamicIndex]
  const valueField = subFields[1 - dynamicIndex]
  if (!columnField.key || !valueField.key) {
    return null
  }

  return {
    columnKey: columnField.key,
    valueKey: valueField.key,
    columnField,
    valueField,
  }
}

export interface ColumnValueRow {
  column: string
  value: string
}

// Resolve a multirow/multirow-multicol value into Column/Value table rows,
// or null if the field's shape doesn't match (caller falls back to the
// generic per-line rendering). Deliberately shows exactly what's saved,
// including blank columns/values, rather than filtering rows out: an empty
// column selector is a real misconfiguration the user should be able to see,
// not something to hide. Only rows that aren't row objects at all are
// dropped, since there's nothing to display for those.
export function resolveColumnValueRows(
  field: IField | undefined,
  value: unknown,
): ColumnValueRow[] | null {
  const shape = getColumnValueFieldShape(field)
  if (!shape || !Array.isArray(value)) {
    return null
  }

  return value
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null
      }
      const obj = item as Record<string, unknown>
      const rawColumn = obj[shape.columnKey]
      const rawValue = obj[shape.valueKey]
      return {
        column:
          rawColumn == null
            ? ''
            : resolveOptionLabel(shape.columnField, String(rawColumn)),
        value:
          rawValue == null
            ? ''
            : resolveOptionLabel(shape.valueField, String(rawValue)),
      }
    })
    .filter((row): row is ColumnValueRow => row !== null)
}
