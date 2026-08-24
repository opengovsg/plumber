import type { MutationResolvers } from '../../__generated__/types.generated'
import createRow from './create-row'
import createRows from './create-rows'
import createTable from './create-table'
import createShareableTableLink from './create-table-shareable-link'
import deleteRows from './delete-rows'
import deleteTable from './delete-table'
import deleteTableCollaborator from './delete-table-collaborator'
import deleteShareableTableLink from './delete-table-shareable-link'
import deleteTableViewPassword from './delete-table-view-password'
import setTableViewPassword from './set-table-view-password'
import updateRow from './update-row'
import updateTable from './update-table'
import upsertTableCollaborator from './upsert-table-collaborator'
import verifyTableViewPassword from './verify-table-view-password'

export default {
  createTable,
  deleteTable,
  updateTable,
  createRow,
  createRows,
  updateRow,
  deleteRows,
  createShareableTableLink,
  deleteShareableTableLink,
  deleteTableCollaborator,
  upsertTableCollaborator,
  setTableViewPassword,
  deleteTableViewPassword,
  verifyTableViewPassword,
} satisfies MutationResolvers
