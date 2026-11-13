import { describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import { generateMockUser } from '@/graphql/__tests__/mutations/flow.mock'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

const TILE_TEMPLATES = TEMPLATES.filter((template) =>
  template.steps.some((step) => step.templateData),
)

describe('createFlowFromTemplate', () => {
  it.each(TILE_TEMPLATES.map((template) => [template.name, template]))(
    'creates a Postgres tile with the template rows for %s',
    async (_name, template) => {
      const user = await generateMockUser('owner')
      const { templateData } = template.steps.find((step) => step.templateData)

      const flow = await createFlowFromTemplate(template.id, user)

      const table = await TableMetadata.query()
        .findById(flow.config.templateConfig.tileId)
        .withGraphFetched('columns')
      expect(table.db).toBe('pg')

      const { rows } = await getTableOperations('pg').getTableRows({
        tableId: table.id,
        columnIds: table.columns.map((column) => column.id),
      })
      const rowsByColumnName = await Promise.all(
        rows.map((row) => table.mapColumnIdsToNames(row.data)),
      )
      // Columns a template row leaves out come back as null.
      expect(rowsByColumnName).toMatchObject(templateData.rowData)
    },
  )

  it.each(TILE_TEMPLATES.map((template) => [template.name, template]))(
    'points every tiles step at the created tile for %s',
    async (_name, template) => {
      const user = await generateMockUser('owner')

      const flow = await createFlowFromTemplate(template.id, user)

      const table = await TableMetadata.query()
        .findById(flow.config.templateConfig.tileId)
        .withGraphFetched('columns')
      const columnIds = table.columns.map((column) => column.id)
      const tileSteps = await flow
        .$relatedQuery('steps')
        .where({ app_key: 'tiles' })
      expect(tileSteps.length).toBeGreaterThan(0)
      for (const step of tileSteps) {
        expect(step.parameters.tableId).toBe(table.id)
        const rows = [
          ...((step.parameters.filters as { columnId: string }[]) ?? []),
          ...((step.parameters.rowData as { columnId: string }[]) ?? []),
        ]
        for (const { columnId } of rows) {
          expect(columnIds).toContain(columnId)
        }
      }
    },
  )
})
