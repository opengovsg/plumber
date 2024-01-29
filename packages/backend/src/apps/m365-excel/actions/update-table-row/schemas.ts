import z from 'zod'

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

// For now, our dataOut is exactly the same as getTableRow's dataOut.
export { dataOutSchema } from '../get-table-row/schemas'
