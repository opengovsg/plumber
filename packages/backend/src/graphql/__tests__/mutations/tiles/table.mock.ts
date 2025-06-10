import { randomUUID } from 'crypto'

import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import { createTableColumns } from '@/models/tiles/pg/table-column-functions'
import { createTable } from '@/models/tiles/pg/table-functions'
import { DatabaseType } from '@/models/tiles/types'
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
  databaseType,
}: {
  userId: string
  databaseType: DatabaseType
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
    db: databaseType,
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

  if (databaseType === 'pg') {
    await createTable(table.id, [])
  }

  return {
    table,
    owner: currentUser,
    editor,
    viewer,
  }
}

// generate mock flow including steps
export async function generateMockFlow({
  userId,
  tableId,
  numSteps,
}: {
  userId: string
  tableId: string
  numSteps: number
}) {
  const currentUser = await User.query().findById(userId)

  const tableName = `test-flow-${tableId}`
  const flowRes = await currentUser.$relatedQuery('flows').insert({
    name: tableName,
  })
  const flowId = flowRes.id

  for (let i = 0; i < numSteps; i++) {
    await generateMockStep({
      tableId,
      flowId,
      position: i + 2,
    })
  }
}

export async function generateMockStep({
  tableId,
  flowId,
  position,
}: {
  tableId: string
  flowId: string
  position?: number
}) {
  await Step.query().insert({
    key: 'createTileRow',
    appKey: 'tiles',
    type: 'action',
    parameters: {
      rowData: [],
      tableId: tableId,
    },
    flowId: flowId,
    status: 'incomplete',
    position: position,
  })
}

export async function generateMockTableColumns({
  tableId,
  numColumns = 5,
  databaseType,
}: {
  tableId: string
  numColumns?: number
  databaseType: DatabaseType
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
  const columnIds = (await Promise.all(promises)).map((column) => column.id)
  if (databaseType === 'pg') {
    await createTableColumns(tableId, columnIds)
  }
  return columnIds
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
