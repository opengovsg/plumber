import { AdminMutationResolvers } from '@/graphql/__generated__/types.generated'

import pauseGroup from './pause-group'
import resumeGroup from './resume-group'
import setGroupConcurrency from './set-group-concurrency'

export default {
  pauseGroup,
  resumeGroup,
  setGroupConcurrency,
} satisfies AdminMutationResolvers
