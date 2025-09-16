import { z } from 'zod'

import {
  CELL_A1_ADDRESS_REGEX,
  fileIdSchema,
  worksheetIdSchema,
} from '../../common/schema'

export const parametersSchema = z.object({
  fileId: fileIdSchema,
  worksheetId: worksheetIdSchema,
  cells: z.array(
    z.object({
      address: z
        .string()
        .min(1, { message: 'Please add a cell address' })
        .trim()
        .regex(CELL_A1_ADDRESS_REGEX, {
          message: 'Invalid cell address format',
        }),
    }),
  ),
})
