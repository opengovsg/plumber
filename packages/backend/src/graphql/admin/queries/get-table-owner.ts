import TableCollaborator from '@/models/table-collaborators'

import type { AdminQueryResolvers } from '../../__generated__/types.generated'

const getTableOwner: AdminQueryResolvers['getTableOwner'] = async (
  _parent,
  params,
  _context,
) => {
  const { tableId } = params

  const tableCollaborator = await TableCollaborator.query()
    .where('table_id', tableId)
    .andWhere('role', 'owner')
    .withGraphJoined({ user: true })
    .throwIfNotFound()
    .first()

  return tableCollaborator.user
}

export default getTableOwner
