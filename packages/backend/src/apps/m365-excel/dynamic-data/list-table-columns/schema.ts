import { z } from 'zod'

import { fileIdSchema, tableIdSchema } from '../../common/schema'

export const parametersSchema = z.object({
  fileId: fileIdSchema,
  tableId: tableIdSchema,
})
