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
  // * We don't trim as we want to match _exactly_ on the user's input.
  // * We allow nullish input to enable matching blank cells, but we convert
  //   such inputs to an empty string, as Excel represents blank cells as an
  //   empty string.
  valueToFind: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
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
