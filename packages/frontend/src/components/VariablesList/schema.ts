import { IJSONObject, IJSONValue } from '@plumber/types'

import { z } from 'zod'

const RowDataSchema = z.object({
  rows: z.array(
    z.object({
      data: z.record(z.string(), z.union([z.string(), z.number()])),
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

const FormSgFieldsSchema = z.record(z.any()).transform((fields) => {
  const tableField = Object.values(fields).find(
    (field: IJSONValue) =>
      typeof field === 'object' &&
      field !== null &&
      (field as IJSONObject).fieldType === 'table',
  ) as IJSONObject | undefined

  if (!tableField) {
    return {
      fieldType: 'table',
      answer: {
        rows: [],
        columns: [],
      },
    }
  }

  return FormSgTableFieldSchema.parse(tableField)
})

/**
 * FormSG has a different dataOut structure from our own apps.
 * it stores the values in fields.answer or fields.answerArray
 *
 * Note: FormSG implements check to have at least 1 row in the table field.
 * the cells may be empty, but there will always be at least 1 row.
 */
export const FormSgTableDataOutSchema = z
  .object({
    fields: FormSgFieldsSchema,
  })
  .transform((dataOut) => {
    const parsedData = dataOut.fields.answer as z.infer<typeof RowDataSchema>
    return {
      rowsFound:
        (parsedData.rows as z.infer<typeof RowDataSchema>['rows'])?.length ?? 0,
      data: parsedData,
    }
  })

export const MultipleRowDataOutSchema = z.object({
  rowsFound: z.union([z.string(), z.number()]).default(0),
  data: RowDataSchema,
})

// Enhanced schema that can handle both regular and FormSG data
export const ExecutionStepDataOutSchema = z.union([
  MultipleRowDataOutSchema,
  FormSgTableDataOutSchema,
])
