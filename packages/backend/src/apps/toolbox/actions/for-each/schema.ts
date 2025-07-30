import { z } from 'zod'

import { tableRowDataSchema } from '@/apps/tiles/actions/find-multiple-rows/schema'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_TABLE_SOURCES,
} from '../../common/constants'

const tableColumnsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    value: z.string(),
  }),
)

const tableRowsSchema = z.array(
  z.object({
    data: tableRowDataSchema,
    rowId: z.string().optional(), // only for tiles
  }),
)

const tableSchema = z.object({
  rows: tableRowsSchema,
  columns: tableColumnsSchema,
  inputSource: z.enum(FOR_EACH_TABLE_SOURCES),
})

const baseDataOutSchema = z.object({
  iterations: z.number(),
})

const dataSchema = z.union([
  z.array(z.any()),
  tableSchema,
  // FormSG Table field is a stringified JSON object
  z.string(),
])

export const inputSchema = z
  .object({
    data: dataSchema,
    testRun: z.boolean(),
  })
  .transform(({ data, testRun }, ctx) => {
    // we allow empty arrays in non-test runs as the checkboxes may be empty
    // however test runs should not be empty as values are needed to set up subsequent steps
    if (
      !data ||
      (typeof data === 'string' && data.trim() === '') ||
      (testRun && Array.isArray(data) && data.length === 0)
    ) {
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
      try {
        const items = typeof data === 'string' ? JSON.parse(data) : data
        return {
          inputSource:
            typeof data === 'string'
              ? FOR_EACH_INPUT_SOURCE.FORMSG_TABLE
              : items.inputSource,
          items: items,
          iterations: items.rows.length,
        }
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid input',
        })
        return z.NEVER
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
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.FORMSG_TABLE),
    items: tableSchema,
  }),
])
