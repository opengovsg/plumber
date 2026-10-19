import { MutationResolvers } from '@/graphql/__generated__/types.generated'
import { addFlowTableConnection } from '@/helpers/add-flow-connection'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

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

const createTable: MutationResolvers['createTable'] = async (
  _parent,
  params,
  context,
) => {
  const { name: tableName, isBlank: isBlankTable, flowId } = params.input

  if (!tableName) {
    throw new Error('Table name is required')
  }

  const tableOperations = getTableOperations('pg')

  const table = await TableMetadata.transaction(async (trx) => {
    const pendingTable = await context.currentUser
      .$relatedQuery('tables', trx)
      .insertGraph({
        name: tableName,
        role: 'owner',
        db: 'pg',
        columns: isBlankTable ? [] : PLACEHOLDER_COLUMNS,
      })

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

  /**
   * COLLABORATORS
   * Owners have the ability to create tables from within the Pipe Editor.
   *
   * If the Pipe has collaborators, we need to:
   *   1. Add the Pipe collaborators as Tile collaborators
   *   2. Add the Tile to the `flow_connections` table
   */
  if (flowId) {
    const flow = await context.currentUser
      .$relatedQuery('flows')
      .findById(flowId)
      .throwIfNotFound()

    await addFlowTableConnection({
      flowId,
      tableId: table.id,
      addedBy: context.currentUser.id,
      flowOwnerId: flow.userId,
    })
  }

  return table
}

export default createTable
