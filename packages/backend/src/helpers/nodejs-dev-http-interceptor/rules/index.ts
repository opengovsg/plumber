import type { DevRequestRule } from '../types'

import { nonoPairRomeCompatRule } from './nono-pair-rome-compat'

export const DEV_REQUEST_RULES: readonly DevRequestRule[] = [
  nonoPairRomeCompatRule,
]
