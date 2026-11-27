import { IGlobalVariable } from '@plumber/types'

import TableCollaborator from '@/models/table-collaborators'

export async function assertTileAccess(
  $: IGlobalVariable,
  tableId: string,
): Promise<void> {
  if (!$.user) {
    throw new Error('Flow is missing an owner')
  }
  await TableCollaborator.hasAccess($.user.id, tableId, 'editor', $)

  // Test runs execute as the pipe owner, so the collaborator who started one
  // must also be able to edit the Tile.
  if ($.loggedInUser && $.loggedInUser.id !== $.user.id) {
    await TableCollaborator.hasAccess($.loggedInUser.id, tableId, 'editor', $)
  }
}
