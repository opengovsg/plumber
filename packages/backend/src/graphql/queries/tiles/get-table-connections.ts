import Flow from '@/models/flow'

import type { QueryResolvers } from '../../__generated__/types.generated'

import getTables from './get-tables'

interface ExtendedFlow extends Flow {
  tableid: string
  count: number
}

interface TableConnection {
  [key: string]: number
}

const getTableConnections: QueryResolvers['getTableConnections'] = async (
  _parent,
  { limit, offset, name },
  context,
) => {
  // get tables of currentUser in the current page
  const tables = await getTables(_parent, { limit, offset, name }, context)

  if (tables.edges.length === 0) {
    return {}
  }
  const tableIds = tables.edges.map((t) => t.node.id)
  const tableIdStr = tableIds.map((id) => `'${id}'`).join(', ')

  // get distinct rows of tables used in flows
  // returns flow id and table id
  const distinctTableFlows = await Flow.query()
    .select(Flow.raw("steps.parameters ->> 'tableId' AS tableid"))
    .countDistinct('flows.id')
    .innerJoinRelated('steps')
    .innerJoinRelated('user')
    .where('steps.app_key', 'tiles')
    .whereRaw("steps.parameters ->> 'tableId' IS NOT NULL")
    .whereRaw(`steps.parameters ->> 'tableId' IN (${tableIdStr})`)
    .groupByRaw("steps.parameters ->> 'tableId'")

  const result = distinctTableFlows.reduce(
    (acc: TableConnection, row: ExtendedFlow) => {
      acc[row.tableid] = row.count
      return acc
    },
    {},
  )

  return result
}

export default getTableConnections
