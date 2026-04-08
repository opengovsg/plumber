import { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'
import Step from '@/models/step'

/**
 * TODO(kevinkim-ogp): remove this after patching the database for all remaining steps
 *
 * We manually patch the step's parameter's so that it contains the new 'filters' field.
 * this ensures that the 'filters' field is automatically populated when we move to this.
 */
const patchParameters = async ($: IGlobalVariable) => {
  try {
    //  manually patch the step's parameter's so that it contains the new 'filters' field.
    await Step.query()
      .patch({
        parameters: {
          ...$.step.parameters,
          filters: [
            {
              lookupColumn: $.step.parameters.lookupColumn,
              lookupValue: $.step.parameters.lookupValue,
            },
          ],
        },
      })
      .where({
        'steps.id': $.step.id,
        'steps.flow_id': $.flow.id,
        'steps.app_key': 'm365-excel',
      })
      .throwIfNotFound()
  } catch (error) {
    // NOTE: we do not want to throw error here so that the test run can continue
    // if this failed, we can still patch it later on
    logger.error(
      'Failed to patch the executionStep and step parameters during test run',
      error,
    )
  }
}

export default patchParameters
