import { TableOperations } from '../types'

import * as tableRowFunctions from './table-row/functions'

function noOp(): Promise<void> {
  return Promise.resolve()
}

export class DynamoDBTableOperations implements TableOperations {
  createTableRow = tableRowFunctions.createTableRow
  createTableRows = tableRowFunctions.createTableRows
  updateTableRow = tableRowFunctions.updateTableRow
  patchTableRow = tableRowFunctions.patchTableRow
  deleteTableRows = tableRowFunctions.deleteTableRows
  getTableRowCount = tableRowFunctions.getTableRowCount
  getTableRows = tableRowFunctions.getTableRows
  getRawRowById = tableRowFunctions.getRawRowById

  createTableColumns = noOp
  deleteTableColumns = noOp

  createTable = noOp
}
