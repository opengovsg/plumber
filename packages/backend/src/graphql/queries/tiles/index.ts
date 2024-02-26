import type { QueryResolvers } from '../../__generated__/types.generated'

import getAllRows from './get-all-rows'
import getTable from './get-table'
import getTables from './get-tables'

export default { getTable, getTables, getAllRows } satisfies QueryResolvers
