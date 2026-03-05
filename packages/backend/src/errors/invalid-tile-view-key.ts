export default class InvalidTileViewKeyError extends Error {
  tableId: string
  viewOnlyKey: string
  code: string
  constructor(tableId: string, viewOnlyKey: string) {
    super('Invalid tile view only key')
    this.code = 'INVALID_TILE_VIEW_KEY'
    this.tableId = tableId
    this.viewOnlyKey = viewOnlyKey
  }
}
