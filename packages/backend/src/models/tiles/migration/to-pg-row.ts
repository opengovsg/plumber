import { z } from 'zod'

export const MAX_TIE_INDEX = 999

export const ddbRowSchema = z.object({
  rowId: z.string(),
  data: z.record(z.string(), z.unknown()).nullish(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type DdbRow = z.infer<typeof ddbRowSchema>

export type PgRow = {
  rowId: string
  createdAt: string
  updatedAt: Date
} & Record<string, string | Date | null>

function toPgValue(value: unknown): { value: string | null; stripped: number } {
  if (value === undefined || value === null) {
    return { value: null, stripped: 0 }
  }
  if (typeof value === 'string') {
    // Postgres text rejects U+0000, so one such cell would fail the tile every night.
    const cleaned = value.replaceAll('\u0000', '')
    return { value: cleaned, stripped: value.length - cleaned.length }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { value: String(value), stripped: 0 }
  }
  return { value: JSON.stringify(value), stripped: 0 }
}

/**
 * Offsets tied createdAt values by microseconds to keep DynamoDB display order
 * under Postgres ("createdAt", "rowId") ordering.
 */
export function toPgRow(
  item: DdbRow,
  columnIds: string[],
  tieIndex: number,
): { row: PgRow; strippedNullChars: number } {
  if (tieIndex > MAX_TIE_INDEX) {
    throw new Error(
      `More than ${MAX_TIE_INDEX + 1} rows share createdAt ${item.createdAt}`,
    )
  }
  // A JS Date cannot carry microseconds, so createdAt must stay a string.
  const createdAt =
    new Date(item.createdAt).toISOString().slice(0, -1) +
    String(tieIndex).padStart(3, '0') +
    'Z'

  const row: PgRow = {
    rowId: item.rowId,
    createdAt,
    updatedAt: new Date(item.updatedAt),
  }
  let strippedNullChars = 0
  for (const columnId of columnIds) {
    const { value, stripped } = toPgValue(item.data?.[columnId])
    row[columnId] = value
    strippedNullChars += stripped
  }
  return { row, strippedNullChars }
}
