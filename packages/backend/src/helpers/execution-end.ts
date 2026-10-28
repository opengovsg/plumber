import type { StepErrorKind } from '@plumber/types'

import type Execution from '@/models/execution'

import { incrementMetric } from './metrics'

type ExecutionOutcome = 'success' | StepErrorKind

const OUTCOME_TAGS: Record<ExecutionOutcome, string> = {
  success: 'success',
  config: 'config',
  'third-party': 'third_party',
  internal: 'internal',
}

/**
 * Feeds the pipe-run SLA, which counts real runs only.
 */
export function countExecutionEnd(
  ended: Pick<Execution, 'testRun'> | undefined,
  outcome: ExecutionOutcome,
): void {
  if (!ended || ended.testRun) {
    return
  }
  incrementMetric('plumber.executions.ended', {
    outcome: OUTCOME_TAGS[outcome],
  })
}
