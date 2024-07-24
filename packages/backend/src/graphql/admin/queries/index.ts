import type { AdminQueryResolvers } from '../../__generated__/types.generated'

import getExecutionOwner from './get-execution-owner'
import getFlowOwner from './get-flow-owner'
import getTableOwner from './get-table-owner'
import searchUsersByEmail from './search-users-by-email'

export default {
  getExecutionOwner,
  getFlowOwner,
  getTableOwner,
  searchUsersByEmail,
} satisfies AdminQueryResolvers
