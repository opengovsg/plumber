import { withTilesMaintenanceCheck } from '@/helpers/temp/tiles-maintenance-check'

import type { MutationResolvers } from '../../__generated__/types.generated'

import createRow from './create-row'
import createRows from './create-rows'
import createTable from './create-table'
import createShareableTableLink from './create-table-shareable-link'
import deleteRows from './delete-rows'
import deleteTable from './delete-table'
import deleteTableCollaborator from './delete-table-collaborator'
import updateRow from './update-row'
import updateTable from './update-table'
import upsertTableCollaborator from './upsert-table-collaborator'

export default {
  createTable: withTilesMaintenanceCheck(createTable),
  deleteTable: withTilesMaintenanceCheck(deleteTable),
  updateTable: withTilesMaintenanceCheck(updateTable),
  createRow: withTilesMaintenanceCheck(createRow),
  createRows: withTilesMaintenanceCheck(createRows),
  updateRow: withTilesMaintenanceCheck(updateRow),
  deleteRows: withTilesMaintenanceCheck(deleteRows),
  createShareableTableLink: withTilesMaintenanceCheck(createShareableTableLink),
  deleteTableCollaborator: withTilesMaintenanceCheck(deleteTableCollaborator),
  upsertTableCollaborator: withTilesMaintenanceCheck(upsertTableCollaborator),
} satisfies MutationResolvers
