import { randomUUID } from 'crypto'

import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

export async function generateMockContext(): Promise<Context> {
  return {
    req: null,
    res: null,
    currentUser: await User.query().findOne({ email: 'tester@open.gov.sg' }),
    isAdminOperation: false,
  }
}

export async function generateMockTable({
  userId,
}: {
  userId: string
}): Promise<{
  table: TableMetadata
  owner: User
  editor: User
  viewer: User
}> {
  const currentUser = await User.query().findById(userId)
  const editor = await User.query().findOne({ email: 'editor@open.gov.sg' })
  const viewer = await User.query().findOne({ email: 'viewer@open.gov.sg' })
  const table = await currentUser.$relatedQuery('tables').insert({
    name: 'Test Table',
    role: 'owner',
  })
  await TableCollaborator.query().insert([
    {
      userId: (await User.query().findOne({ email: 'editor@open.gov.sg' })).id,
      tableId: table.id,
      role: 'editor',
    },
    {
      userId: (await User.query().findOne({ email: 'viewer@open.gov.sg' })).id,
      tableId: table.id,
      role: 'viewer',
    },
  ])
  return {
    table,
    owner: currentUser,
    editor,
    viewer,
  }
}

export async function generateMockTableColumns({
  tableId,
  numColumns = 5,
}: {
  tableId: string
  numColumns?: number
}): Promise<string[]> {
  const promises = []
  for (let i = 0; i < numColumns; i++) {
    promises.push(
      TableColumnMetadata.query().insert({
        name: `Test Column ${i}`,
        tableId,
        position: i,
        config: {
          width: 100 + i,
        },
      }),
    )
  }
  return (await Promise.all(promises)).map((column) => column.id)
}

export function generateMockTableRowData({
  columnIds,
}: {
  columnIds: string[]
}): Record<string, string> {
  return columnIds.reduce((acc, id) => {
    acc[id] = `test_${randomUUID()}`
    return acc
  }, {} as Record<string, string>)
}
