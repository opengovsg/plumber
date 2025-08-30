import { AdminMutationResolvers } from '@/graphql/__generated__/types.generated'

import pauseGroup from './pause-group'
import resumeGroup from './resume-group'

export default {
  pauseGroup,
  resumeGroup,
} satisfies AdminMutationResolvers
