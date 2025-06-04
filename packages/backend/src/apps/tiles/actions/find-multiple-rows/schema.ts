import { z } from 'zod'

const tableRowOutputSchema = z.object({
  rowId: z.string(),
  data: z.record(z.string(), z.string().or(z.number())),
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
