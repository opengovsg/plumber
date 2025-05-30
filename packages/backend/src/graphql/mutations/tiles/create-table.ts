import { MutationResolvers } from '@/graphql/__generated__/types.generated'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import { type DatabaseType } from '@/models/tiles/types'

const PLACEHOLDER_COLUMNS = [
  {
    name: 'Column 1',
    position: 0,
  },
  {
    name: 'Column 2',
    position: 1,
  },
  {
    name: 'Column 3',
    position: 2,
  },
]
const PLACEHOLDER_ROWS = new Array(5).fill({})

// DELETE THIS FLAG ONCE IT'S NO LONGER IN USE
const DATABASE_TYPE_LD_FLAG_KEY = 'tiles-database-type'

const createTable: MutationResolvers['createTable'] = async (
  _parent,
  params,
  context,
) => {
  const { name: tableName, isBlank: isBlankTable } = params.input

  if (!tableName) {
    throw new Error('Table name is required')
  }

  /**
   * Check which database type user is allowed to create
   */
  const databaseType = (await getLdFlagValue(
    DATABASE_TYPE_LD_FLAG_KEY,
    context.currentUser.email,
    'ddb',
  )) as DatabaseType

  const tableOperations = getTableOperations(databaseType)

  const table = await TableMetadata.transaction(async (trx) => {
    const pendingTable = await context.currentUser
      .$relatedQuery('tables', trx)
      .insertGraph({
        name: tableName,
        role: 'owner',
        db: databaseType,
        columns: isBlankTable ? [] : PLACEHOLDER_COLUMNS,
      })

    console.log('here')

    await tableOperations.createTable(
      pendingTable.id,
      isBlankTable ? [] : pendingTable.columns.map((column) => column.id),
    )

    return pendingTable
  })

  if (!isBlankTable) {
    await tableOperations.createTableRows({
      tableId: table.id,
      dataArray: PLACEHOLDER_ROWS,
    })
  }

  return table
}

export default createTable
