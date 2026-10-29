import type { IJSONObject, TemplateData } from '@plumber/types'
import type { Knex } from 'knex'
import type { z } from 'zod'

import type { FlowConfig } from '@/graphql/__generated__/types.generated'
import type User from '@/models/user'

export interface TemplateDataResult {
  // Merged into the placeholder replacement map of createFlowFromTemplate.
  placeholders: IJSONObject
  templateConfig?: Partial<FlowConfig['templateConfig']>
}

export interface TemplateDataHandler<T extends TemplateData = TemplateData> {
  schema: z.ZodType<T>
  /**
   * IMPORTANT: `trx` only covers the main database. Writes to other stores
   * stay behind if the flow creation fails.
   */
  create(args: {
    user: User
    templateData: T
    position: number
    trx: Knex.Transaction
  }): Promise<TemplateDataResult>
}
