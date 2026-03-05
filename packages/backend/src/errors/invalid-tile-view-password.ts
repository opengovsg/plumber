export default class InvalidTileViewTokenError extends Error {
  tableId: string
  tableName: string
  code: string
  constructor(tableId: string, tableName: string) {
    super('Tile is password-protected')
    this.code = 'INVALID_TILE_VIEW_TOKEN'
    this.tableId = tableId
    this.tableName = tableName
  }
}
