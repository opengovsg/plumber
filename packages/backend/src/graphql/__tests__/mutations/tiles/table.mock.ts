import { randomUUID } from 'crypto'

import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

export async function generateMockContext(): Promise<Context> {
  return {
    req: null,
    res: null,
    currentUser: await User.query().findOne({ email: 'tester@open.gov.sg' }),
  }
}

export async function generateMockTable({
  userId,
}: {
  userId: string
}): Promise<TableMetadata> {
  return TableMetadata.query().insert({
    name: 'Test Table',
    userId: userId,
  })
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
