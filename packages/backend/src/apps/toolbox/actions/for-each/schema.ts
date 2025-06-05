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

    if (Array.isArray(data)) {
      return {
        type: 'checkbox' as const,
        items: data,
      }
    } else {
      return {
        type: 'table' as const,
        items: data,
      }
    }
  })

export const dataOutSchema = z.discriminatedUnion('inputSource', [
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.CHECKBOX),
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
