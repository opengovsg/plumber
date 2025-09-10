import z from 'zod'

import { fileIdSchema, tableIdSchema } from '../../common/schema'
import { hexEncodedRowRecordSchema } from '../../common/workbook-helpers/tables'

export const parametersSchema = z.object({
  fileId: fileIdSchema,
  tableId: tableIdSchema,
  // Populated by dynamic data, so no need to trim.
  lookupColumn: z.string().min(1, {
    message: 'Please select a column to lookup from.',
  }),
  // * We don't trim as we want to match _exactly_ on the user's input.
  // * We allow empty strings to support optional form fields.
  lookupValue: z.string().default(''),
})

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
