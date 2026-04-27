import z from 'zod'

import { lookupParametersSchema } from '../../common/schema'
import { hexEncodedRowRecordSchema } from '../../common/workbook-helpers/tables'

// Use the validated lookup parameters schema from common
export const parametersSchema = lookupParametersSchema

export const dataOutSchema = z.discriminatedUnion('foundRow', [
  z.object({ foundRow: z.literal(false) }),
  z.object({
    foundRow: z.literal(true),
    rowData: hexEncodedRowRecordSchema,
    sheetRowNumber: z.number(),
    // optional for backward compatibility
    columns: z.array(z.string()).optional(),
  }),
])
