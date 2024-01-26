import z from 'zod'

import { hexEncodedRowRecordSchema } from '../../common/workbook-helpers/tables'

export const parametersSchema = z.object({
  fileId: z
    .string()
    .trim()
    .min(1, { message: 'Please choose a file to lookup from.' }),
  tableId: z
    .string()
    .trim()
    .min(1, { message: 'Please select a table to lookup from.' }),
  // Populated by dynamic data, so no need to trim.
  columnName: z.string().min(1, {
    message: 'Please select a column to match against.',
  }),
  // * We don't trim as we want to match _exactly_ on the user's input.
  // * We allow nullish input to enable matching blank cells, but we convert
  //   such inputs to an empty string, as Excel represents blank cells as an
  //   empty string.
  valueToFind: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
})

export const dataOutSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(false) }),
  z.object({
    success: z.literal(true),
    rowData: hexEncodedRowRecordSchema,
    tableRowNumber: z.number(),
    sheetRowNumber: z.number(),
  }),
])
