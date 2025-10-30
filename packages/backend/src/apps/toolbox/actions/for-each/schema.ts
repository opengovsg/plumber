import { z } from 'zod'

import { tableRowDataSchema } from '@/apps/tiles/actions/find-multiple-rows/schema'
import { VARIABLE_REGEX } from '@/helpers/check-step-parameters'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_MAX_ITERATIONS,
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

    // NOTE: string arrays do not have inputSource, so we need to infer it from the data object.
    // we also slice the array to the FOR_EACH_MAX_ITERATIONS to avoid misuse
    // if users call the updateStep mutation directly with more than 500 items or rows
    if (Array.isArray(data)) {
      const items = data.slice(0, FOR_EACH_MAX_ITERATIONS)
      return {
        inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
        items,
        iterations: items.length,
      }
    } else {
      try {
        const items = typeof data === 'string' ? JSON.parse(data) : data
        const rows = items.rows.slice(0, FOR_EACH_MAX_ITERATIONS)
        return {
          inputSource:
            typeof data === 'string'
              ? FOR_EACH_INPUT_SOURCE.FORMSG_TABLE
              : items.inputSource,
          items: {
            ...items,
            rows,
          },
          iterations: rows.length,
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid input',
        })
        return z.NEVER
      }
    }
  })

/* TODO (kevinkim-ogp): this is the new dataOut format for Tile columns
 * This is the new dataOut format for the columns used in for each
 * so that it respects the column order but is unaffected when users
 * reorder the columns in the Tile
 */
const dataOutColumnSchema = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: z.string(),
    value: z.string(),
    order: z.number(),
  }),
)

const dataOutTableSchema = z.object({
  rows: tableRowsSchema,
  columns: dataOutColumnSchema,
  inputSource: z.enum(FOR_EACH_TABLE_SOURCES),
})

// TODO (kevinkim-ogp): remove the union once all users have moved to the new dataOut format
export const dataOutSchema = z.discriminatedUnion('inputSource', [
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.STRING_ARRAY),
    items: z.array(z.string()),
  }),
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.M365_EXCEL),
    items: z.union([tableSchema, dataOutTableSchema]),
  }),
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.TILES),
    items: z.union([tableSchema, dataOutTableSchema]),
  }),
  baseDataOutSchema.extend({
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.FORMSG_TABLE),
    items: z.union([tableSchema, dataOutTableSchema]),
  }),
])

const PARAMETER_ERROR_MESSAGE = 'For each input must be a variable'

export const parameterSchema = z.object({
  items: z
    .string({
      required_error: PARAMETER_ERROR_MESSAGE,
      invalid_type_error: PARAMETER_ERROR_MESSAGE,
    })
    .refine((v) => VARIABLE_REGEX.test(v), {
      message: PARAMETER_ERROR_MESSAGE,
    })
    // could be null when user is updating the step name before selecting a variable
    .nullish(),
})
