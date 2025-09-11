import { z } from 'zod'

import { fileIdSchema } from '../../common/schema'

export const parametersSchema = z.object({
  fileId: fileIdSchema,
})
