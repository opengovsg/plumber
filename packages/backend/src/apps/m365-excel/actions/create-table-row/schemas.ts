import { z } from 'zod'

export const parametersSchema = z.object({
  fileId: z
    .string()
    .trim()
    .min(1, { message: 'Please choose a file to lookup from.' }),
  tableId: z
    .string()
    .trim()
    .min(1, { message: 'Please select a table to lookup from.' }),
  columnValues: z
    .array(
      z.object({
        // Populated by dynamic data, so no need to trim.
        columnName: z
          .string()
          .min(1, { message: 'Please select a column to create.' }),
        // We allow empty strings to support optional form fields.
        value: z.string(),
      }),
    )
    .min(1, { message: 'Please input at least 1 column to create.' })
    .superRefine((columnValues, context) => {
      // Shoud not have repeated columns
      const seenColumnNames = new Set<string>()

      for (const columnToAdd of columnValues) {
        if (seenColumnNames.has(columnToAdd.columnName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Column '${columnToAdd.columnName}' can only be created once. Remove duplicate '${columnToAdd.columnName}' columns from the 'Set up row to create' section.`,
            fatal: true,
          })
          return z.NEVER
        }

        seenColumnNames.add(columnToAdd.columnName)
      }
    }),
})
