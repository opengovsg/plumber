import TableCollaborator from '@/models/table-collaborators'

export async function validateTileAccess(
  userId: string,
  tableId: string,
): Promise<void | never> {
  const collaborator = await TableCollaborator.query().findOne({
    table_id: tableId,
    user_id: userId,
  })
  if (!collaborator) {
    throw new Error('User does not have access to tile')
  }
  return
}
