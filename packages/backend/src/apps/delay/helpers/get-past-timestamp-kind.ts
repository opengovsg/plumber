import type { IGlobalVariable, StepErrorKind } from '@plumber/types'

import delayForAsMilliseconds, {
  type TDelayForUnit,
} from '@/helpers/delay-for-as-milliseconds'
import ExecutionStep from '@/models/execution-step'

import generateTimestamp from './generate-timestamp'

function getDelayEndTimestamp(executionStep: ExecutionStep): number {
  const { dataOut } = executionStep
  if (executionStep.key === 'delayFor') {
    return (
      new Date(executionStep.createdAt).getTime() +
      delayForAsMilliseconds(
        dataOut.delayForUnit as TDelayForUnit,
        Number(dataOut.delayForValue),
      )
    )
  }
  return generateTimestamp(
    String(dataOut.delayUntil),
    String(dataOut.delayUntilTime),
  )
}

/**
 * Chooses the kind for a delay until target that passed before this step ran.
 */
export default async function getPastTimestampKind(
  $: IGlobalVariable,
  delayTimestamp: number,
): Promise<StepErrorKind> {
  const iteration = Number($.metadata?.iteration) || undefined
  const executionSteps = await ExecutionStep.query()
    .select('status', 'app_key', 'key', 'data_out', 'created_at')
    .where('execution_id', $.execution.id)
    .where((builder) => {
      builder.where('status', 'failure').orWhere('app_key', 'delay')
    })
    .where((builder) => {
      // Other for-each iterations never hold up this one.
      if (iteration !== undefined) {
        builder.whereRaw(`(metadata ->> 'iteration') is null`)
        builder.orWhereRaw(`(metadata ->> 'iteration')::int = ?`, [iteration])
      }
    })

  // Delay until timing is not guaranteed once a run has been retried.
  if (
    executionSteps.some((executionStep) => executionStep.status === 'failure')
  ) {
    return 'config'
  }

  const isPushedPastByEarlierDelay = executionSteps.some(
    (executionStep) =>
      executionStep.appKey === 'delay' &&
      getDelayEndTimestamp(executionStep) >= delayTimestamp,
  )
  return isPushedPastByEarlierDelay ? 'config' : 'third-party'
}
