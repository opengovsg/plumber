/**
 * SQL for the user who created the pipe aliased `flowAlias`.
 *
 * IMPORTANT: a transfer rewrites flows.user_id, so the creator is the old owner of the pipe's
 * first approved transfer.
 */
export function flowCreatorSql(flowAlias: string): string {
  return `coalesce(
    (
      SELECT ft.old_owner_id
      FROM flow_transfers ft
      WHERE ft.flow_id = ${flowAlias}.id AND ft.status = 'approved'
      ORDER BY ft.created_at
      LIMIT 1
    ),
    ${flowAlias}.user_id
  )`
}
