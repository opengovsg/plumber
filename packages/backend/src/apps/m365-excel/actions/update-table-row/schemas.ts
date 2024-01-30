import z from 'zod'

import { hexEncodedRowRecordSchema } from '../../common/workbook-helpers/tables'
import { parametersSchema as getTableRowParametersSchema } from '../get-table-row/schemas'

export const parametersSchema = getTableRowParametersSchema.extend({
  columnsToUpdate: z
    .array(
      z.object({
        // Populated by dynamic data, so no need to trim.
        columnName: z
          .string()
          .min(1, { message: 'Please select a column to update.' }),
        // We allow empty strings to support optional form fields.
        value: z.string(),
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

export const dataOutSchema = z.discriminatedUnion('updatedRow', [
  z.object({ updatedRow: z.literal(false) }),
  z.object({
    updatedRow: z.literal(true),
    rowData: hexEncodedRowRecordSchema,
    sheetRowNumber: z.number(),
  }),
])
