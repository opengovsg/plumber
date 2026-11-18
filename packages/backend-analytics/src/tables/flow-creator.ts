// One pass over flow_transfers. A lookup per pipe scans the table once per pipe, because no index covers approved transfers.
export const FIRST_APPROVED_TRANSFER = `(
  SELECT DISTINCT ON (flow_id) flow_id, old_owner_id
  FROM flow_transfers
  WHERE status = 'approved'
  ORDER BY flow_id, created_at, id
) AS first_transfer`

/**
 * SQL that joins each pipe aliased `flowAlias` to its first approved transfer. Use with `flowCreatorSql`.
 */
export function firstApprovedTransferJoin(flowAlias: string): string {
  return `LEFT JOIN ${FIRST_APPROVED_TRANSFER} ON first_transfer.flow_id = ${flowAlias}.id`
}

/**
 * SQL for the user who created the pipe aliased `flowAlias`. Needs `firstApprovedTransferJoin`.
 *
 * IMPORTANT: a transfer rewrites flows.user_id, so the creator is the old owner of the pipe's
 * first approved transfer.
 */
export function flowCreatorSql(flowAlias: string): string {
  return `coalesce(first_transfer.old_owner_id, ${flowAlias}.user_id)`
}
