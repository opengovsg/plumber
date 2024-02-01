import z from 'zod'

export const hexEncodedRowRecordSchema = z.record(
  z.string().regex(/[\da-f]/i),
  z.object({
    value: z.string(),
    columnName: z.string(),
  }),
)

export type HexEncodedRowRecord = z.infer<typeof hexEncodedRowRecordSchema>

export function convertRowToHexEncodedRowRecord(args: {
  row: string[]
  columns: string[]
}): HexEncodedRowRecord {
  const { row, columns } = args
  const result: HexEncodedRowRecord = Object.create(null)

  for (const [cellIndex, cell] of row.entries()) {
    const cellColumnName = columns[cellIndex]
    const hexEncodedColumnName = Buffer.from(cellColumnName).toString('hex')

    result[hexEncodedColumnName] = {
      value: cell,
      columnName: cellColumnName,
    }
  }

  return result
}
