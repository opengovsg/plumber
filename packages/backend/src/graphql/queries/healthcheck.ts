import appConfig from '@/config/app'

import type { QueryResolvers } from '../__generated__/types.generated'

const healthcheck: QueryResolvers['healthcheck'] = () => {
  return {
    version: appConfig.version,
  }
}

export default healthcheck
