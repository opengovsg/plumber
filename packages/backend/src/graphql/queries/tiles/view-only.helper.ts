import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import InvalidTileViewTokenError from '@/errors/invalid-tile-view-password'
import { verifyViewToken } from '@/helpers/auth-tiles'
import TableMetadata from '@/models/table-metadata'
import type { UnauthenticatedContext } from '@/types/express/context'

interface ViewOnlyCheckResult {
  table: TableMetadata
}

interface ViewOnlyCheckOptions {
  tableId: string
  context: UnauthenticatedContext
  withColumns?: boolean
}

export async function fetchTableWithViewOnlyCheck({
  tableId,
  context,
  withColumns,
}: ViewOnlyCheckOptions): Promise<ViewOnlyCheckResult> {
  let query = TableMetadata.query().findOne({
    id: tableId,
    view_only_key: context.tilesViewKey,
  })

  if (withColumns) {
    query = query.withGraphFetched('columns')
  }

  const table = await query

  if (!table) {
    throw new InvalidTileViewKeyError(tableId, context.tilesViewKey)
  }

  const isPasswordBlocked =
    !!table.viewOnlyPassword &&
    (!context.tilesViewToken ||
      !verifyViewToken(
        context.tilesViewToken,
        table.id,
        context.tilesViewKey,
        table.viewOnlyPassword.tokenNonce,
      ))

  if (isPasswordBlocked) {
    throw new InvalidTileViewTokenError(tableId, table.name)
  }

  return { table }
}
