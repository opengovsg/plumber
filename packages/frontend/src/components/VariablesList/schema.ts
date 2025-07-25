import { z } from 'zod'

const RowDataSchema = z.object({
  rows: z.array(
    z.object({
      // for tiles v1, empty cells is either an empty string or wont even have their key returned
      // for tiles v2, empty cells return null
      data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      rowId: z.string().optional(), // only Tiles will have this
    }),
  ),
  columns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      value: z.string(),
    }),
  ),
})

export const ExecutionStepDataOutSchema = z.object({
  rowsFound: z.union([z.string(), z.number()]).default('0'),
  data: RowDataSchema,
})
