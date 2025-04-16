import type { AdminMutationResolvers } from '../../__generated__/types.generated'

import addGsi from './add-gsi'
import patchGsiRows from './patch-gsi-rows'

export default {
  addGsi,
  patchGsiRows,
} satisfies AdminMutationResolvers
