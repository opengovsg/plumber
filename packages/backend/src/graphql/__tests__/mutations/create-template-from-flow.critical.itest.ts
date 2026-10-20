/**
 * Collaborator template rules:
 * - Editors and viewers can save an accessible pipe as their own template.
 * - The template drops file, table, and secret parameters.
 * - Pipes created from that template do not receive them either.
 * - Owners keep every parameter.
 */
import { IFlowCollabRole } from '@plumber/types'

import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import createTemplateFromFlow from '@/graphql/mutations/create-template-from-flow'
import getTemplates from '@/graphql/queries/get-templates'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import Template from '@/models/template'
import User from '@/models/user'
import Context from '@/types/express/context'

const contextFor = (user: User) =>
  ({
    req: null,
    res: null,
    currentUser: user,
    isAdminOperation: false,
  } as unknown as Context)

let owner: User
let flow: Flow

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
  await flow.$relatedQuery('steps').insert([
    {
      key: 'createTileRow',
      appKey: 'tiles',
      type: 'action',
      position: 2,
      parameters: {
        tableId: 'owner-table',
        rowData: [{ columnId: 'col-1', cellValue: triggerVariable }],
      },
    },
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
      parameters: {
        url: 'https://example.com',
        customHeaders: [
          { key: 'Authorization', value: 'Bearer abc' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
    },
  ])
}

function expectSanitized(parameters: Record<string, unknown>[]): void {
  const [gather, tiles, excel, customApi] = parameters
  expect(gather.encryptionKey).toBeUndefined()
  expect(tiles.tableId).toBeUndefined()
  expect(tiles.rowData).toEqual([expect.objectContaining({ columnId: '' })])
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

  it('keeps every parameter', async () => {
    const result = await createTemplateFromFlow(
      null,
      { input: { flowId: flow.id } },
      contextFor(owner),
    )

    const [gather, tiles, excel, customApi] = result.steps.map(
      (step) => step.parameters ?? {},
    )
    expect(gather.encryptionKey).toBe('gather-secret')
    expect(tiles.tableId).toBe('owner-table')
    expect(excel.fileId).toBe('file-1')
    expect(customApi.customHeaders).toHaveLength(2)
  })
})
