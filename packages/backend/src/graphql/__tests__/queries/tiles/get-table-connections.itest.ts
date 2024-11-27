import crypto from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import getTableConnections from '@/graphql/queries/tiles/get-table-connections'
import getTables from '@/graphql/queries/tiles/get-tables'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockFlow,
  generateMockTable,
} from '../../mutations/tiles/table.mock'

interface TablePipeCountObj {
  [key: string]: number
}

function getRandNum() {
  return crypto.randomInt(1, 6)
}

describe('get table connections query', () => {
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()
  })

  it('should return empty object if no tables found', async () => {
    const { edges } = await getTables(null, { limit: 10, offset: 0 }, context)
    const tables = edges.map((edge) => edge.node)
    expect(tables).toHaveLength(0)

    const tableConnections = await getTableConnections(
      null,
      { tableIds: [] },
      context,
    )
    expect(tableConnections).toEqual({})
    expect(Object.keys(tableConnections).length).toBe(0)
  })

  it('should return empty object if user has no access to any tables', async () => {
    const numTables = 5
    const testIds = Array.from({ length: numTables }, () => crypto.randomUUID())

    const tableConnections = await getTableConnections(
      null,
      { tableIds: testIds },
      context,
    )
    expect(tableConnections).toEqual({})
    expect(Object.keys(tableConnections).length).toBe(0)
  })

  it('should return the correct number of table connections for user flows only', async () => {
    const numTables = 5
    const tablePipeCount: TablePipeCountObj = {}
    for (let i = 0; i < numTables; i++) {
      const res = await generateMockTable({ userId: context.currentUser.id })
      const { id: tableId } = res.table

      const [numFlows, numSteps] = [getRandNum(), getRandNum()]
      tablePipeCount[tableId] = numFlows

      for (let i = 0; i < numFlows; i++) {
        await generateMockFlow({
          userId: context.currentUser.id,
          tableId,
          numSteps,
        })
      }
    }

    // tests each page
    const limit = 2
    for (let i = 0; i < Math.ceil(numTables / 2); i++) {
      const offset = limit * i
      const { edges, pageInfo } = await getTables(
        null,
        { limit, offset },
        context,
      )

      const pageTables = edges.map((edge) => edge.node)
      const expectedLength = Math.min(limit, numTables - limit * i)
      expect(pageTables).toHaveLength(expectedLength)
      expect(pageInfo.currentPage).toBe(i + 1)
      expect(pageInfo.totalCount).toBe(numTables)

      const pageTableIds = edges.map((edge) => edge.node.id)

      const tableConnections = await getTableConnections(
        null,
        { tableIds: pageTableIds },
        context,
      )
      expect(Object.keys(tableConnections).length).toBe(expectedLength)
      expect(Object.keys(tableConnections).sort()).toEqual(pageTableIds.sort())

      Object.entries(tableConnections).forEach(([key, value]) => {
        expect(value).toBe(tablePipeCount[key])
      })
    }
  })

  it('should return the correct number of table connections for flows by user and editor', async () => {
    const numTables = 5
    const tablePipeCount: TablePipeCountObj = {}
    for (let i = 0; i < numTables; i++) {
      const res = await generateMockTable({ userId: context.currentUser.id })
      const { id: tableId } = res.table
      const { id: editorId } = res.editor

      const [numFlows, numSteps] = [getRandNum(), getRandNum()]
      const [editorFlows, editorSteps] = [getRandNum(), getRandNum()]

      tablePipeCount[tableId] = numFlows + editorFlows
      for (let i = 0; i < numFlows; i++) {
        await generateMockFlow({
          userId: context.currentUser.id,
          tableId,
          numSteps,
        })
      }
      for (let i = 0; i < editorFlows; i++) {
        await generateMockFlow({
          userId: editorId,
          tableId,
          numSteps: editorSteps,
        })
      }
    }

    // tests each page
    const limit = 2
    for (let i = 0; i < Math.ceil(numTables / 2); i++) {
      const offset = limit * i
      const { edges, pageInfo } = await getTables(
        null,
        { limit, offset },
        context,
      )

      const pageTables = edges.map((edge) => edge.node)
      const expectedLength = Math.min(limit, numTables - limit * i)
      expect(pageTables).toHaveLength(expectedLength)
      expect(pageInfo.currentPage).toBe(i + 1)
      expect(pageInfo.totalCount).toBe(numTables)

      const pageTableIds = edges.map((edge) => edge.node.id)

      const tableConnections = await getTableConnections(
        null,
        { tableIds: pageTableIds },
        context,
      )
      expect(Object.keys(tableConnections).length).toBe(expectedLength)
      expect(Object.keys(tableConnections).sort()).toEqual(pageTableIds.sort())

      Object.entries(tableConnections).forEach(([key, value]) => {
        expect(value).toBe(tablePipeCount[key])
      })
    }
  })

  it('should not return table connections for tables the user does not have access to', async () => {
    const numTables = 5
    const tablePipeCount: TablePipeCountObj = {}
    for (let i = 0; i < numTables; i++) {
      const res = await generateMockTable({ userId: context.currentUser.id })
      const { id: tableId } = res.table
      const { id: editorId } = res.editor

      const [numFlows, numSteps] = [getRandNum(), getRandNum()]
      const [editorFlows, editorSteps] = [getRandNum(), getRandNum()]

      tablePipeCount[tableId] = numFlows + editorFlows
      for (let i = 0; i < numFlows; i++) {
        await generateMockFlow({
          userId: context.currentUser.id,
          tableId,
          numSteps,
        })
      }
      for (let i = 0; i < editorFlows; i++) {
        await generateMockFlow({
          userId: editorId,
          tableId,
          numSteps: editorSteps,
        })
      }
    }

    // test as a whole
    const { edges, pageInfo } = await getTables(
      null,
      { limit: 10, offset: 0 },
      context,
    )

    const pageTables = edges.map((edge) => edge.node)
    expect(pageTables).toHaveLength(numTables)
    expect(pageInfo.currentPage).toBe(1)
    expect(pageInfo.totalCount).toBe(numTables)

    const pageTableIds = edges.map((edge) => edge.node.id)
    const testIds = [...pageTableIds, crypto.randomUUID()] // add a random table id
    expect(testIds).toHaveLength(numTables + 1)
    const tableConnections = await getTableConnections(
      null,
      { tableIds: testIds },
      context,
    )
    expect(Object.keys(tableConnections).length).toBe(numTables)
    expect(Object.keys(tableConnections).sort()).toEqual(pageTableIds.sort())

    Object.entries(tableConnections).forEach(([key, value]) => {
      expect(value).toBe(tablePipeCount[key])
    })
  })

  it('should throw error if tableIds is null', async () => {
    await expect(
      getTableConnections(null, { tableIds: null }, context),
    ).rejects.toThrow('tableIds is required')
  })
})
