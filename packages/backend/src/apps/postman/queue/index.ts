import type { IAppQueue } from '@plumber/types'

import appConfig from '@/config/app'

const queueSettings = {
  queueRateLimit: {
    duration: 1000,
    max: appConfig.postman.rateLimit,
  },
  isQueueDelayable: true,
} satisfies IAppQueue

export default queueSettings
