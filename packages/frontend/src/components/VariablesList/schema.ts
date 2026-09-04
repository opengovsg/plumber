import { IJSONObject } from '@plumber/types'
import get from 'lodash/get'
import { z } from 'zod'

const RowDataSchema = z.object({
  rows: z.array(
    z.object({
      // for tiles v1, empty cells is either an empty string or wont even have their key returned
      // for tiles v2, empty cells return null
      data: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.null()]).default(null),
      ),
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

const FormSgTableFieldSchema = z.object({
  fieldType: z.literal('table'),
  // formsg table field is a stringified JSON object
  // as the formsg sdk only allows strings in the answer field
  answer: z.string().transform((val) => JSON.parse(val) as IJSONObject),
})

const FormSgFieldSchema = z.object({
  fieldType: z.string(),
  answer: z.union([z.string(), z.record(z.string(), z.any())]).nullish(),
})

const createFormSgFieldsSchema = (variableId: string) => {
  const regex = new RegExp(
    /step\.[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\.fields\.([^.]+)\.answer/,
  )
  const match = variableId.match(regex)
  const tableFieldId = match?.[1]

  return z.record(z.string(), FormSgFieldSchema).transform((fields) => {
    if (!tableFieldId) {
      return {
        fieldType: 'table',
        answer: {
          rows: [],
          columns: [],
        },
      }
    }

    const tableField = get(fields, tableFieldId)
    return FormSgTableFieldSchema.parse(tableField)
  })
}

/**
 * FormSG has a different dataOut structure from our own apps.
 * it stores the values in fields.answer or fields.answerArray
 *
 * Note: FormSG implements check to have at least 1 row in the table field.
 * the cells may be empty, but there will always be at least 1 row.
 */
export const createFormSgTableDataOutSchema = (variableName: string) =>
  z
    .object({
      fields: createFormSgFieldsSchema(variableName),
    })
    .transform((dataOut) => {
      const parsedData = dataOut.fields.answer as z.infer<typeof RowDataSchema>
      return {
        rowsFound:
          (parsedData.rows as z.infer<typeof RowDataSchema>['rows'])?.length ??
          0,
        data: parsedData,
      }
    })

export const MultipleRowDataOutSchema = z.object({
  rowsFound: z.union([z.string(), z.number()]).default(0),
  data: RowDataSchema,
})

// Enhanced schema that can handle both regular and FormSG data
export const createExecutionStepDataOutSchema = (variableName: string) =>
  z.union([
    MultipleRowDataOutSchema,
    createFormSgTableDataOutSchema(variableName),
  ])
