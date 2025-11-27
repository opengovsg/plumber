import { Transaction } from 'objection'

import Step from '@/models/step'

export async function removeMrfSteps(flowId: string, trx?: Transaction) {
  const executeQueries = async (trx: Transaction) => {
    // delete all mrf action steps
    await Step.query(trx)
      .where('flow_id', flowId)
      .where('type', 'action')
      .where('key', 'mrfSubmission')
      .delete()

    // reset trigger step parameters
    await Step.query(trx)
      .where('flow_id', flowId)
      .where('type', 'trigger')
      .where('key', 'newSubmission')
      .patch({
        parameters: {},
      })

    // Delete all steps in the reject branch
    await Step.query(trx)
      .where('flow_id', flowId)
      .where('type', 'action')
      .andWhereRaw(`steps.config->'approval'->>'branch' = ?`, ['reject'])
      .delete()
      .debug()

    await Step.query(trx)
      .where('flow_id', flowId)
      .where('type', 'action')
      .patch({
        // remove approval config from all action steps
        config: Step.knex().raw(`(steps.config::jsonb - 'approval')::jsonb`),
      })

    await Step.resetStepOrdering(flowId, trx)
  }

  if (trx) {
    await executeQueries(trx)
  } else {
    await Step.transaction(executeQueries)
  }
}
