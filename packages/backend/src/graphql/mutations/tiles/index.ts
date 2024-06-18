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
  createTable,
  deleteTable,
  updateTable,
  createRow,
  createRows,
  updateRow,
  deleteRows,
  createShareableTableLink,
  deleteTableCollaborator,
  upsertTableCollaborator,
} satisfies MutationResolvers
