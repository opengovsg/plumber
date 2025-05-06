import { TableOperations } from '../types'

import * as tableColumnFunctions from './table-column-functions'
import * as tableFunctions from './table-functions'
import * as tableRowFunctions from './table-row-functions'

export class PostgresTableOperations implements TableOperations {
  createTableRow = tableRowFunctions.createTableRow
  createTableRows = tableRowFunctions.createTableRows
  updateTableRow = tableRowFunctions.updateTableRow
  patchTableRow = tableRowFunctions.patchTableRow
  deleteTableRows = tableRowFunctions.deleteTableRows
  getTableRowCount = tableRowFunctions.getTableRowCount
  getTableRows = tableRowFunctions.getTableRows
  getRawRowById = tableRowFunctions.getRawRowById

  createTableColumns = tableColumnFunctions.createTableColumns
  deleteTableColumns = tableColumnFunctions.deleteTableColumns

  createTable = tableFunctions.createTable
}
