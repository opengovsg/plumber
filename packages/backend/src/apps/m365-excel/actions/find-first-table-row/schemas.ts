import z from 'zod'

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
  // We don't trim as we want to match _exactly_ on the user's input.
  valueToFind: z.string().min(1, {
    message: 'Please input a value to match against.',
  }),
})

export const tableRowResponseSchema = z
  .object({
    values: z
      .array(z.array(z.coerce.string()))
      // Must contain at least the header row.
      .min(1),
  })
  .transform((response) => response.values)

export const dataOutSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(false) }),
  z.object({
    success: z.literal(true),
    rowData: z.record(
      z.object({
        value: z.string(),
        columnName: z.string(),
      }),
    ),
  }),
])
