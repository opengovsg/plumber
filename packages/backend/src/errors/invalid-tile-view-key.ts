export default class InvalidTileViewKeyError extends Error {
  tableId: string
  viewOnlyKey: string
  constructor(tableId: string, viewOnlyKey: string) {
    super('Invalid tile view only key')
    this.tableId = tableId
    this.viewOnlyKey = viewOnlyKey
  }
}
