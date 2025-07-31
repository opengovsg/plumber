import { withTilesMaintenanceCheck } from '@/helpers/temp/tiles-maintenance-check'

import type { QueryResolvers } from '../../__generated__/types.generated'

import getAllRows from './get-all-rows'
import getTable from './get-table'
import getTableConnections from './get-table-connections'
import getTables from './get-tables'

export default {
  getTable: withTilesMaintenanceCheck(getTable),
  getTableConnections: withTilesMaintenanceCheck(getTableConnections),
  getTables: withTilesMaintenanceCheck(getTables),
  getAllRows: withTilesMaintenanceCheck(getAllRows),
} satisfies QueryResolvers
