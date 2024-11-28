import type { QueryResolvers } from '../../__generated__/types.generated'

import getAllRows from './get-all-rows'
import getTable from './get-table'
import getTableConnections from './get-table-connections'
import getTables from './get-tables'

export default {
  getTable,
  getTableConnections,
  getTables,
  getAllRows,
} satisfies QueryResolvers
