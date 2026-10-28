import type { Redis } from 'ioredis'

import type { ReconcilerCheck } from './run-checks'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange'>
}

export function createReconcilerChecks(
  _input: CreateReconcilerChecksInput,
): ReconcilerCheck[] {
  return []
}
