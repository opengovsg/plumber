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
    // Protect the flow from same-night re-archival before we start restoring,
    // so there is no race window with the archival routine. Sets archiveDisabled
    // in the flow's config JSONB so the eligibility query skips it until the
    // operator clears the flag:
    //   UPDATE flows SET config = config - 'archiveDisabled' WHERE id = '<id>';
    await trx.raw(
      `UPDATE flows SET config = COALESCE(config, '{}') || ?::jsonb WHERE id = ?`,
      [JSON.stringify({ archiveDisabled: true }), execution.flowId],
    )

    const insertedExecution = await trx('executions')
      .insert({
        id: execution.id,
        flow_id: execution.flowId,
        status: execution.status,
        test_run: execution.testRun,
        internal_id: execution.internalId,
        created_at: execution.createdAt,
        updated_at: execution.updatedAt,
        deleted_at: execution.deletedAt,
      })
      .onConflict('id')
      .ignore()
      .returning('id')
    executionInserted = insertedExecution.length > 0

    if (steps.length > 0) {
      const insertedSteps = await trx('execution_steps')
        .insert(
          steps.map((step) => ({
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
          })),
        )
        .onConflict('id')
        .ignore()
        .returning('id')
      stepsInserted = insertedSteps.length
    }

    // Only decrement when we actually inserted a new row: onConflict().ignore()
    // above means a retried/idempotent restore of an already-restored execution
    // must not decrement the counter a second time. Guard against going
    // negative in case the counter is ever already at 0.
    if (executionInserted) {
      await trx('flows')
        .where('id', execution.flowId)
        .where('archived_execution_count', '>', 0)
        .decrement('archived_execution_count', 1)
    }
  })

  return { executionInserted, stepsInserted }
}
