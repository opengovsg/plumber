import { z } from 'zod'

const tableRowOutputSchema = z.object({
  rowId: z.string(),
  // for tiles v1, empty cells is either an empty string or wont even have their key returned
  // for tiles v2, empty cells return null
  data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
})

export const dataOutSchema = z.object({
  rowsFound: z.number(),
  data: z
    .object({
      rows: z.array(tableRowOutputSchema),
      columns: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          value: z.string(),
        }),
      ),
    })
    .optional(),
})
