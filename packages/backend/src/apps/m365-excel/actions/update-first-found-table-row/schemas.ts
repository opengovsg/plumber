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
  columnsToUpdate: z
    .array(
      z.object({
        // Populated by dynamic data, so no need to trim.
        columnName: z
          .string()
          .min(1, { message: 'Please select a column to update.' }),
        // Nullish because we allow clearing cells by specifying a blank value.
        value: z
          .string()
          .nullish()
          // Excel stores empty cells as empty strings, so we convert null to
          // empty strings.
          .transform((val) => val ?? ''),
      }),
    )
    .min(1, { message: 'Please input at least 1 column to update.' })
    .superRefine((columnsToUpdate, context) => {
      // Shoud not have repeated columns
      const seenColumnNames = new Set<string>()
      for (const columnToUpdate of columnsToUpdate) {
        if (seenColumnNames.has(columnToUpdate.columnName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Cannot update the same column (${columnToUpdate.columnName}) twice. Double check your step configuration.`,
            fatal: true,
          })
          return z.NEVER
        }
        seenColumnNames.add(columnToUpdate.columnName)
      }
    }),
})

export const updateRowValuesResponseSchema = z
  .object({
    values: z
      .array(z.array(z.coerce.string()))
      // We only update one row, so outer array must be of length 1.
      .length(1),
  })
  .transform((response) => response.values[0])

export const dataOutSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(false) }),
  z.object({
    success: z.literal(true),
    rowData: hexEncodedRowRecordSchema,
    tableRowNumber: z.number(),
    sheetRowNumber: z.number(),
  }),
])
