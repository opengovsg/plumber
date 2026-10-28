import { randomUUID } from 'crypto'

/**
 * Collaborator template rules:
 * - Editors and viewers can save an accessible pipe as their own template.
 * - The template drops file, table, and secret parameters.
 * - Pipes created from that template do not receive them either.
 * - Owners keep every parameter except the source Tiles table and column IDs.
 *
 * Template rules for every role:
 * - The template never keeps the source Tiles table and column IDs.
 * - The template keeps the source tile's name and column names, but no rows.
 * - Pipes created from that template get a new empty tile with those columns.
 *   Steps and variables that used the source tile use the new tile instead.
 * - The template drops admin overrides, template guidance and AI Builder config.
 * - Pipes created from that template do not receive them either.
 */
import { IFlowCollabRole } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import createTemplateFromFlow from '@/graphql/mutations/create-template-from-flow'
import getTemplates from '@/graphql/queries/get-templates'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import TableMetadata from '@/models/table-metadata'
import Template from '@/models/template'
import User from '@/models/user'
import Context from '@/types/express/context'

vi.mock('@/helpers/plumpro', () => ({ isPlumPro: async () => true }))

const contextFor = (user: User) =>
  ({
    req: null,
    res: null,
    currentUser: user,
    isAdminOperation: false,
  }) as unknown as Context

let owner: User
let flow: Flow
let sourceTile: TableMetadata
let tilesStep: Step

async function seedFlow(): Promise<void> {
  await FlowCollaborator.query().delete()
  await Step.query().delete()
  await Template.query().delete()
  await Flow.query().delete()

  owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
  flow = await owner
    .$relatedQuery('flows')
    .insertAndFetch({ name: 'Source Flow' })

  const trigger = await flow.$relatedQuery('steps').insertAndFetch({
    key: 'newInstantWorkflow',
    appKey: 'gathersg',
    type: 'trigger',
    position: 1,
    parameters: { encryptionKey: 'gather-secret' },
  })
  const triggerVariable = `{{step.${trigger.id}.fields.abc.answer}}`
  sourceTile = await owner.$relatedQuery('tables').insertGraph({
    name: 'Owner tile',
    role: 'owner',
    db: 'pg',
    columns: [
      { name: 'Name', position: 0 },
      { name: 'Amount (SGD)', position: 1 },
    ],
  })
  const [nameColumn, amountColumn] = [...sourceTile.columns].sort(
    (a, b) => a.position - b.position,
  )
  tilesStep = await flow.$relatedQuery('steps').insertAndFetch({
    key: 'createTileRow',
    appKey: 'tiles',
    type: 'action',
    position: 2,
    parameters: {
      tableId: sourceTile.id,
      rowData: [{ columnId: nameColumn.id, cellValue: triggerVariable }],
    },
  })
  await flow.$relatedQuery('steps').insert([
    {
      key: 'createTableRow',
      appKey: 'm365-excel',
      type: 'action',
      position: 3,
      parameters: {
        fileId: 'file-1',
        worksheetId: 'sheet-1',
        tableId: 'table-1',
        columnValues: [{ columnName: 'Name', value: triggerVariable }],
      },
    },
    {
      key: 'httpRequest',
      appKey: 'custom-api',
      type: 'action',
      position: 4,
      config: {
        stepName: 'Call API',
        adminOverride: { customApiTimeout: 60000 },
        templateConfig: { appEventKey: 'stale_event' },
        aiBuilderConfig: [{ traceId: 'trace-1', tool: 'create_step' }],
      },
      parameters: {
        url: 'https://example.com',
        data: `{{step.${tilesStep.id}.row.${amountColumn.id}}}`,
        customHeaders: [
          { key: 'Authorization', value: 'Bearer abc' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
    },
  ])
}

function expectNoSourceTileIds(parameters: Record<string, unknown>[]): void {
  const serialized = JSON.stringify(parameters)
  for (const id of [sourceTile.id, ...sourceTile.columns.map((c) => c.id)]) {
    expect(serialized).not.toContain(id)
  }
}

function expectSanitized(parameters: Record<string, unknown>[]): void {
  const [gather, , excel, customApi] = parameters
  expectNoSourceTileIds(parameters)
  expect(gather.encryptionKey).toBeUndefined()
  expect(excel.fileId).toBeUndefined()
  expect(excel.worksheetId).toBeUndefined()
  expect(excel.tableId).toBeUndefined()
  expect(excel.columnValues).toEqual([
    expect.objectContaining({ columnName: 'Name' }),
  ])
  expect(customApi.url).toBe('https://example.com')
  expect(customApi.customHeaders).toEqual([
    { key: 'Content-Type', value: 'application/json' },
  ])
}

describe.each<IFlowCollabRole>(['editor', 'viewer'])(
  'createTemplateFromFlow by a %s',
  (role) => {
    let collaborator: User

    beforeEach(async () => {
      await seedFlow()
      collaborator = await User.query().insert({
        email: `${randomUUID()}@open.gov.sg`,
      })
      await FlowCollaborator.query().insert({
        flowId: flow.id,
        userId: collaborator.id,
        role,
        updatedBy: owner.id,
      })
    })

    const exportTemplate = () =>
      createTemplateFromFlow(
        null,
        { input: { flowId: flow.id } },
        contextFor(collaborator),
      )

    it('returns sanitized template parameters', async () => {
      const result = await exportTemplate()

      expectSanitized(result.steps.map((step) => step.parameters ?? {}))
    })

    it('stores sanitized template steps', async () => {
      const { id } = await exportTemplate()

      const template = await Template.query()
        .findById(id)
        .withGraphFetched({ templateSteps: true })
        .throwIfNotFound()
      expect(template.userId).toBe(collaborator.id)
      const stored = [...template.templateSteps]
        .map(({ data }) => data)
        .sort((a, b) => a.position - b.position)
      expectSanitized(stored.map((step) => step.parameters ?? {}))
    })

    it('lists sanitized parameters in the collaborator templates', async () => {
      const { id } = await exportTemplate()

      const templates = await getTemplates(
        null,
        {},
        contextFor(collaborator),
        null,
      )
      const template = templates.find((t) => t.id === id)
      expectSanitized(template.steps.map((step) => step.parameters ?? {}))
    })

    it('creates pipes without the owner parameters', async () => {
      const { id } = await exportTemplate()

      const newFlow = await createFlowFromTemplate(id, collaborator)
      const steps = await newFlow.$relatedQuery('steps').orderBy('position')
      expectSanitized(steps.map((step) => step.parameters))
    })

    it('leaves the source pipe parameters untouched', async () => {
      await exportTemplate()

      const steps = await flow.$relatedQuery('steps').orderBy('position')
      expect(steps[0].parameters.encryptionKey).toBe('gather-secret')
      expect(steps[2].parameters.fileId).toBe('file-1')
    })
  },
)

describe('createTemplateFromFlow by the owner', () => {
  beforeEach(seedFlow)

  const exportTemplate = () =>
    createTemplateFromFlow(
      null,
      { input: { flowId: flow.id } },
      contextFor(owner),
    )

  it('keeps every parameter except the source Tiles table and column IDs', async () => {
    const result = await exportTemplate()

    const parameters = result.steps.map((step) => step.parameters ?? {})
    const [gather, , excel, customApi] = parameters
    expectNoSourceTileIds(parameters)
    expect(gather.encryptionKey).toBe('gather-secret')
    expect(excel.fileId).toBe('file-1')
    expect(customApi.customHeaders).toHaveLength(2)
  })
})

describe.each<IFlowCollabRole>(['owner', 'editor', 'viewer'])(
  'createTemplateFromFlow tiles by a %s',
  (role) => {
    let user: User

    beforeEach(async () => {
      await seedFlow()
      user = owner
      if (role !== 'owner') {
        user = await User.query().insert({
          email: `${randomUUID()}@open.gov.sg`,
        })
        await FlowCollaborator.query().insert({
          flowId: flow.id,
          userId: user.id,
          role,
          updatedBy: owner.id,
        })
      }
    })

    const exportTemplate = () =>
      createTemplateFromFlow(
        null,
        { input: { flowId: flow.id } },
        contextFor(user),
      )

    it('keeps the source tile name and column names without rows', async () => {
      const { id } = await exportTemplate()

      const template = await Template.findOneForUser(user.id, id)
      expect(template.steps[1].templateData).toEqual({
        name: 'Owner tile',
        columns: ['Name', 'Amount (SGD)'],
      })
    })

    it('creates pipes with a new empty tile that steps and variables use', async () => {
      const { id } = await exportTemplate()

      const newFlow = await createFlowFromTemplate(id, user)
      const steps = await newFlow.$relatedQuery('steps').orderBy('position')
      expectNoSourceTileIds(steps.map((step) => step.parameters))

      const newTile = await TableMetadata.query()
        .findById(steps[1].parameters.tableId as string)
        .withGraphFetched({ columns: true })
        .throwIfNotFound()
      expect(newTile.columns.map((column) => column.name)).toEqual([
        'Name',
        'Amount (SGD)',
      ])
      const [nameColumn, amountColumn] = newTile.columns
      expect(steps[1].parameters.rowData).toEqual([
        expect.objectContaining({ columnId: nameColumn.id }),
      ])
      expect(steps[3].parameters.data).toBe(
        `{{step.${steps[1].id}.row.${amountColumn.id}}}`,
      )
    })

    it('drops the Tiles table and column IDs when the source tile is deleted', async () => {
      await sourceTile.$query().delete()

      const result = await exportTemplate()

      const tiles = result.steps[1]
      expect(tiles.parameters.tableId).toBeUndefined()
      expect(tiles.parameters.rowData).toEqual([
        expect.objectContaining({ columnId: '' }),
      ])
      expect(tiles).not.toHaveProperty('templateData')
    })
  },
)

describe.each<IFlowCollabRole>(['owner', 'editor', 'viewer'])(
  'createTemplateFromFlow step config by a %s',
  (role) => {
    let user: User

    beforeEach(async () => {
      await seedFlow()
      user = owner
      if (role !== 'owner') {
        user = await User.query().insert({
          email: `${randomUUID()}@open.gov.sg`,
        })
        await FlowCollaborator.query().insert({
          flowId: flow.id,
          userId: user.id,
          role,
          updatedBy: owner.id,
        })
      }
    })

    it('drops admin overrides, template guidance and AI Builder config', async () => {
      const result = await createTemplateFromFlow(
        null,
        { input: { flowId: flow.id } },
        contextFor(user),
      )

      expect(result.steps[3].config).toEqual({ stepName: 'Call API' })

      const newFlow = await createFlowFromTemplate(result.id, user)
      const step = await newFlow.$relatedQuery('steps').findOne({ position: 4 })
      expect(step.config.adminOverride).toBeUndefined()
      expect(step.config.aiBuilderConfig).toBeUndefined()
      expect(step.config.templateConfig).toEqual({
        appEventKey: 'custom-api_httpRequest',
      })
      expect(step.config.stepName).toBe('Call API')
    })
  },
)
