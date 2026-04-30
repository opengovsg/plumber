import z from 'zod'

import { hexEncodedRowRecordSchema } from '../../common/workbook-helpers/tables'

export const dataOutSchema = z.discriminatedUnion('foundRow', [
  z.object({ foundRow: z.literal(false) }),
  z.object({
    foundRow: z.literal(true),
    rowData: hexEncodedRowRecordSchema,
    sheetRowNumber: z.number(),
    // optional for backward compatibility
    columns: z.array(z.string()).optional(),
  }),
])
