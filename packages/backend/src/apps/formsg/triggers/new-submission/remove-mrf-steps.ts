import { IGlobalVariable } from '@plumber/types'

import StepError from '@/errors/step'
import Step from '@/models/step'

export async function removeMrfSteps($: IGlobalVariable) {
  if (!$.flow?.id || !$.step?.id) {
    throw new StepError(
      'Missing flow or step',
      'This should not happen, please contact support.',
      $.step.position,
      $.app.name,
    )
  }

  await Step.transaction(async (trx) => {
    // delete all mrf action steps
    await Step.query(trx)
      .where('flow_id', $.flow.id)
      .where('type', 'action')
      .where('key', 'mrfSubmission')
      .delete()

    // reset trigger step parameters
    await Step.query(trx)
      .where('flow_id', $.flow.id)
      .where('type', 'trigger')
      .where('key', 'newSubmission')
      .patch({
        parameters: {},
      })
  })
}
