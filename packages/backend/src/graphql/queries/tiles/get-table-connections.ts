import Flow from '@/models/flow'

import type { QueryResolvers } from '../../__generated__/types.generated'

import getTables from './get-tables'

interface ExtendedFlow extends Flow {
  tableid: string
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
    .distinct('flows.id', Flow.raw("steps.parameters ->> 'tableId' AS tableId"))
    .innerJoinRelated('steps')
    .innerJoinRelated('user')
    .where('steps.app_key', 'tiles')
    .whereRaw("steps.parameters ->> 'tableId' IS NOT NULL")
    .whereRaw(`steps.parameters ->> 'tableId' IN (${tableIdStr})`)

  const result = distinctTableFlows.reduce(
    (acc: TableConnection, obj: ExtendedFlow) => {
      acc[obj.tableid] = (acc[obj.tableid] || 0) + 1
      return acc
    },
    {},
  )

  return result
}

export default getTableConnections
