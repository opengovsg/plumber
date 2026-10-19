import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tilesClient } from '@/config/tiles-database'
import { TEMPLATES } from '@/db/storage'
import { generateMockUser } from '@/graphql/__tests__/mutations/flow.mock'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import * as getStepVersionModule from '@/helpers/get-step-version'
import Flow from '@/models/flow'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import * as tableFunctions from '@/models/tiles/pg/table-functions'
import * as tableRowFunctions from '@/models/tiles/pg/table-row-functions'

vi.mock('@/models/tiles/pg/table-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof tableFunctions>()),
}))
vi.mock('@/models/tiles/pg/table-row-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof tableRowFunctions>()),
}))
vi.mock('@/helpers/get-step-version', async (importOriginal) => ({
  ...(await importOriginal<typeof getStepVersionModule>()),
}))

const TILE_TEMPLATES = TEMPLATES.filter((template) => template.tileTemplateData)
const TILE_TEMPLATE = TILE_TEMPLATES[0]
const NON_TILE_TEMPLATE = TEMPLATES.find(
  (template) => !template.tileTemplateData,
)

function listTileTableNames(): Promise<string[]> {
  return tilesClient('pg_catalog.pg_tables')
    .where('schemaname', 'public')
    .pluck('tablename')
}

describe('createFlowFromTemplate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.each(TILE_TEMPLATES.map((template) => [template.name, template]))(
    'creates a Postgres tile with the template rows for %s',
    async (_name, template) => {
      const user = await generateMockUser('owner')

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
      expect(rowsByColumnName).toMatchObject(template.tileTemplateData.rowData)
    },
  )

  it('creates a flow without a tile for a template that has no tile data', async () => {
    const user = await generateMockUser('owner')
    const tableNamesBefore = await listTileTableNames()

    const flow = await createFlowFromTemplate(NON_TILE_TEMPLATE.id, user)

    expect(flow.config.templateConfig.tileId).toBeUndefined()
    expect(await TableMetadata.query().resultSize()).toBe(0)
    expect(await listTileTableNames()).toEqual(tableNamesBefore)
  })

  describe('when creation fails after the physical table is created', () => {
    it('drops the physical table when the sample rows cannot be written', async () => {
      const user = await generateMockUser('owner')
      const tableNamesBefore = await listTileTableNames()
      vi.spyOn(tableRowFunctions, 'createTableRows').mockRejectedValueOnce(
        new Error('tiles database is down'),
      )

      await expect(
        createFlowFromTemplate(TILE_TEMPLATE.id, user),
      ).rejects.toThrow('Creation of tile ran into an issue')

      expect(await listTileTableNames()).toEqual(tableNamesBefore)
      expect(await TableMetadata.query().resultSize()).toBe(0)
      expect(await Flow.query().resultSize()).toBe(0)
    })

    it('drops the physical table when a later step insert fails', async () => {
      const user = await generateMockUser('owner')
      const tableNamesBefore = await listTileTableNames()
      vi.spyOn(getStepVersionModule, 'getStepVersion').mockImplementationOnce(
        () => {
          throw new Error('step version lookup failed')
        },
      )

      await expect(
        createFlowFromTemplate(TILE_TEMPLATE.id, user),
      ).rejects.toThrow('step version lookup failed')

      expect(await listTileTableNames()).toEqual(tableNamesBefore)
      expect(await TableMetadata.query().resultSize()).toBe(0)
      expect(await Flow.query().resultSize()).toBe(0)
    })

    it('keeps the original error when the cleanup itself fails', async () => {
      const user = await generateMockUser('owner')
      vi.spyOn(tableRowFunctions, 'createTableRows').mockRejectedValueOnce(
        new Error('tiles database is down'),
      )
      vi.spyOn(tableFunctions, 'deleteTable').mockRejectedValueOnce(
        new Error('drop table failed'),
      )

      await expect(
        createFlowFromTemplate(TILE_TEMPLATE.id, user),
      ).rejects.toThrow('Creation of tile ran into an issue')
    })
  })

  it('leaves no physical table behind when table creation itself fails', async () => {
    const user = await generateMockUser('owner')
    const tableNamesBefore = await listTileTableNames()
    vi.spyOn(tableFunctions, 'createTable').mockRejectedValueOnce(
      new Error('tiles database is down'),
    )

    await expect(
      createFlowFromTemplate(TILE_TEMPLATE.id, user),
    ).rejects.toThrow('Creation of tile ran into an issue')

    expect(await listTileTableNames()).toEqual(tableNamesBefore)
    expect(await TableMetadata.query().resultSize()).toBe(0)
    expect(await Flow.query().resultSize()).toBe(0)
  })
})
