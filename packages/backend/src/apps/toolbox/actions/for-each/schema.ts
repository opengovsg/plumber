import { z } from 'zod'

import { FOR_EACH_INPUT_SOURCE } from '../../common/constants'

const tableColumnsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    value: z.string(),
  }),
)

const tableRowsSchema = z.array(
  z.object({
    data: z.record(z.string(), z.string().or(z.number())),
    rowId: z.string().optional(), // only for tiles
  }),
)

const tableSchema = z.object({
  rows: tableRowsSchema,
  columns: tableColumnsSchema,
  inputSource: z.enum([
    FOR_EACH_INPUT_SOURCE.TILES,
    FOR_EACH_INPUT_SOURCE.M365_EXCEL,
  ]),
})

const baseDataOutSchema = z.object({
  iterations: z.number(),
})

export const inputSchema = z
  .union([z.array(z.any()), tableSchema])
  .transform((data, ctx) => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Input cannot be empty',
      })
      return z.NEVER
    }

    // NOTE: string arrays do not have inputSource, so we need to infer it from the data object
    if (Array.isArray(data)) {
      return {
        inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
        items: data,
        iterations: data.length,
      }
    } else {
      return {
        inputSource: data.inputSource,
        items: data,
        iterations: data.rows.length,
      }
    }
  })

export const dataOutSchema = z.discriminatedUnion('inputSource', [
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.STRING_ARRAY),
    items: z.array(z.string()),
  }),
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.M365_EXCEL),
    items: tableSchema,
  }),
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.TILES),
    items: tableSchema,
  }),
])
