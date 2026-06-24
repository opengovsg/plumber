import type { Knex } from 'knex'

import type { ArchivedPayload } from './types'

export type RestoreResult = {
  executionInserted: boolean
  stepsInserted: number
}

export async function restoreExecution(
  payload: ArchivedPayload,
  knexClient: Knex,
): Promise<RestoreResult> {
  const { execution, steps } = payload
  let executionInserted = false
  let stepsInserted = 0

  await knexClient.transaction(async (trx) => {
    const existing = await trx('executions')
      .where('id', execution.id)
      .first('id')

    if (!existing) {
      await trx('executions').insert({
        id: execution.id,
        flow_id: execution.flowId,
        status: execution.status,
        test_run: execution.testRun,
        internal_id: execution.internalId,
        created_at: execution.createdAt,
        updated_at: execution.updatedAt,
        deleted_at: execution.deletedAt,
      })
      executionInserted = true
    }

    for (const step of steps) {
      const existingStep = await trx('execution_steps')
        .where('id', step.id)
        .first('id')

      if (!existingStep) {
        await trx('execution_steps').insert({
          id: step.id,
          execution_id: step.executionId,
          step_id: step.stepId,
          app_key: step.appKey,
          key: step.key,
          job_id: step.jobId,
          status: step.status,
          data_in: step.dataIn,
          data_out: step.dataOut,
          error_details: step.errorDetails,
          metadata: step.metadata,
          created_at: step.createdAt,
          updated_at: step.updatedAt,
          deleted_at: step.deletedAt,
        })
        stepsInserted++
      }
    }

    // Protect the flow from same-night re-archival. Sets archiveDisabled in the
    // flow's config JSONB so the eligibility query skips it until the operator
    // clears the flag:
    //   UPDATE flows SET config = config - 'archiveDisabled' WHERE id = '<id>';
    await trx.raw(
      `UPDATE flows SET config = COALESCE(config, '{}') || ?::jsonb WHERE id = ?`,
      [JSON.stringify({ archiveDisabled: true }), execution.flowId],
    )
  })

  return { executionInserted, stepsInserted }
}
