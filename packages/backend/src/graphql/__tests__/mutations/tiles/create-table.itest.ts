import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import createTable from '@/graphql/mutations/tiles/create-table'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import TableCollaborator from '@/models/table-collaborators'
import * as ddbTableRowFunctions from '@/models/tiles/dynamodb/table-row/functions'
import * as pgTableFunctions from '@/models/tiles/pg/table-functions'
import * as pgTableRowFunctions from '@/models/tiles/pg/table-row-functions'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockCollaborator, generateMockUser } from '../flow.mock'

import { generateMockContext } from './table.mock'
import { checkIfTableExists } from './tiles-pg-helper'

const pgCreateTableSpy = vi.spyOn(pgTableFunctions, 'createTable')
const pgCreateTableRowsSpy = vi.spyOn(pgTableRowFunctions, 'createTableRows')
const ddbCreateTableRowsSpy = vi.spyOn(ddbTableRowFunctions, 'createTableRows')

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

async function generateFlowWithCollaborators(ownerId: string) {
  const flow = await Flow.query().insert({
    id: randomUUID(),
    name: 'Test Flow',
    userId: ownerId,
  })

  const editor = await generateMockUser('editor')
  const viewer = await generateMockUser('viewer')

  await generateMockCollaborator(flow.id, editor.id, ownerId, 'editor')
  await generateMockCollaborator(flow.id, viewer.id, ownerId, 'viewer')

  return { flow, editor, viewer }
}

describe.each([['pg'], ['ddb']])(
  'create table mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context

    // cant use before all here since the data is re-seeded each time
    beforeEach(async () => {
      context = await generateMockContext()
      pgCreateTableSpy.mockClear()
      pgCreateTableRowsSpy.mockClear()
      ddbCreateTableRowsSpy.mockClear()
    })

    it('should create a blank table', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: true } },
        context,
      )
      const tableColumnCount = await table.$relatedQuery('columns').resultSize()
      expect(table.name).toBe('Test Table')
      expect(tableColumnCount).toBe(0)
      expect(pgCreateTableRowsSpy).not.toHaveBeenCalled()
      expect(ddbCreateTableRowsSpy).not.toHaveBeenCalled()
      if (databaseType === 'pg') {
        expect(pgCreateTableSpy).toHaveBeenCalledWith(table.id, [])
        // we check if the table is actually created here
        expect(await checkIfTableExists(table.id)).toBe(true)
      }
    })

    it('should create a table and with placeholder rows and columns', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )
      const tableColumnCount = await table.$relatedQuery('columns').resultSize()
      expect(table.name).toBe('Test Table')
      expect(tableColumnCount).toBe(3)

      expect(
        databaseType === 'pg' ? pgCreateTableRowsSpy : ddbCreateTableRowsSpy,
      ).toHaveBeenCalledWith({
        tableId: table.id,
        dataArray: new Array(5).fill({}),
      })
    })

    it('should be able create tables with the same name', async () => {
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )

      const table2 = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )
      expect(table.name).toBe('Test Table')
      expect(table2.name).toBe('Test Table')
    })

    it('should throw an error when table name is empty', async () => {
      await expect(
        createTable(null, { input: { name: '', isBlank: false } }, context),
      ).rejects.toThrow()
    })

    describe('with flowId - table_collaborators updates', () => {
      let testFlow: Flow
      let flowEditor: User
      let flowViewer: User

      beforeEach(async () => {
        const flowData = await generateFlowWithCollaborators(
          context.currentUser.id,
        )
        testFlow = flowData.flow
        flowEditor = flowData.editor
        flowViewer = flowData.viewer
      })

      it('should add all flow collaborators to table_collaborators when flowId is provided', async () => {
        mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

        const table = await createTable(
          null,
          {
            input: {
              name: 'Flow Table',
              isBlank: true,
              flowId: testFlow.id,
            },
          },
          context,
        )

        // Verify flow owner is added as table editor
        const ownerCollab = await TableCollaborator.query().findOne({
          user_id: testFlow.userId,
          table_id: table.id,
        })
        expect(ownerCollab).toBeDefined()
        expect(ownerCollab.role).toBe('owner')

        // Verify flow editor is added as table editor
        const editorCollab = await TableCollaborator.query().findOne({
          user_id: flowEditor.id,
          table_id: table.id,
        })
        expect(editorCollab).toBeDefined()
        expect(editorCollab.role).toBe('editor')

        // Verify flow viewer is added as table viewer
        const viewerCollab = await TableCollaborator.query().findOne({
          user_id: flowViewer.id,
          table_id: table.id,
        })
        expect(viewerCollab).toBeDefined()
        expect(viewerCollab.role).toBe('viewer')

        // Verify flow connection is created
        const flowConnection = await FlowConnections.query().findOne({
          flow_id: testFlow.id,
          connection_id: table.id,
        })
        expect(flowConnection).toBeDefined()
        expect(flowConnection.connectionType).toBe('table')
      })

      it('should throw error when user is not the flow owner', async () => {
        mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

        // Create context with flow editor (not owner)
        const editorContext: Context = {
          req: null,
          res: null,
          currentUser: flowEditor,
          isAdminOperation: false,
        }

        await expect(
          createTable(
            null,
            {
              input: {
                name: 'Editor Flow Table',
                isBlank: true,
                flowId: testFlow.id,
              },
            },
            editorContext,
          ),
        ).rejects.toThrow()
      })

      it('should throw error when flowId does not exist', async () => {
        mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

        const nonExistentFlowId = randomUUID()

        await expect(
          createTable(
            null,
            {
              input: {
                name: 'Flow Table',
                isBlank: true,
                flowId: nonExistentFlowId,
              },
            },
            context,
          ),
        ).rejects.toThrow()
      })
    })
  },
)
