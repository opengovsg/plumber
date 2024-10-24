import { beforeEach, describe, expect, it } from 'vitest'

import getTables from '@/graphql/queries/tiles/get-tables'
import TableCollaborator from '@/models/table-collaborators'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
} from '../../mutations/tiles/table.mock'

describe('get tables query', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()
  })
  it('should return array of tables belonging to users', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const { edges, pageInfo } = await getTables(
      null,
      { limit: 10, offset: 0 },
      context,
    )
    const tables = edges.map((edge) => edge.node)
    expect(tables).toHaveLength(numTables)
    expect(pageInfo.currentPage).toBe(1)
    expect(pageInfo.totalCount).toBe(numTables)
  })

  it('should return empty array if no tables found', async () => {
    const { edges, pageInfo } = await getTables(
      null,
      { limit: 10, offset: 0 },
      context,
    )
    const tables = edges.map((edge) => edge.node)
    expect(tables).toHaveLength(0)
    expect(pageInfo.currentPage).toBe(1)
    expect(pageInfo.totalCount).toBe(0)
  })

  it('should throw an error if collaborator does not exist or is soft deleted', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const { edges, pageInfo } = await getTables(
      null,
      { limit: 10, offset: 0 },
      context,
    )
    const tables = edges.map((edge) => edge.node)
    expect(tables).toHaveLength(numTables)
    expect(pageInfo.currentPage).toBe(1)
    expect(pageInfo.totalCount).toBe(numTables)
    await TableCollaborator.query()
      .delete()
      .where('table_id', tables[0].id)
      .andWhere('user_id', context.currentUser.id)
    const { edges: newEdges } = await getTables(
      null,
      { limit: 10, offset: 0 },
      context,
    )

    const newTables = newEdges.map((edge) => edge.node)
    await expect(newTables).toHaveLength(numTables - 1)
  })

  it('should filter by name', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const { edges } = await getTables(
      null,
      { limit: 10, offset: 0, name: 'Test Table' },
      context,
    )
    const tables = edges.map((edge) => edge.node)
    expect(tables).toHaveLength(numTables)

    const { edges: newEdges } = await getTables(
      null,
      { limit: 10, offset: 0, name: 'Invalid name' },
      context,
    )
    const noTables = newEdges.map((edge) => edge.node)
    expect(noTables).toHaveLength(0)
  })

  it('should paginate tables', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const { edges: firstPage, pageInfo: firstPageInfo } = await getTables(
      null,
      { limit: 2, offset: 0 },
      context,
    )
    const firstPageTables = firstPage.map((edge) => edge.node)
    expect(firstPageTables).toHaveLength(2)
    expect(firstPageInfo.currentPage).toBe(1)
    expect(firstPageInfo.totalCount).toBe(numTables)

    const { edges: secondPage, pageInfo: secondPageInfo } = await getTables(
      null,
      { limit: 2, offset: 2 },
      context,
    )
    const secondPageTables = secondPage.map((edge) => edge.node)
    expect(secondPageTables).toHaveLength(2)
    expect(secondPageInfo.currentPage).toBe(2)
    expect(secondPageInfo.totalCount).toBe(numTables)
  })

  it('should return the corresponding roles of each user', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const { edges } = await getTables(null, { limit: 10, offset: 0 }, context)
    const tables = edges.map((edge) => edge.node)
    for (const table of tables) {
      expect(table.role).toBe('owner')
    }
  })
})
