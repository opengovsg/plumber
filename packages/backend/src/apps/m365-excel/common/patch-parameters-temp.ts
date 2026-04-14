import { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'
import Step from '@/models/step'

/**
 * TODO(kevinkim-ogp): remove this after patching the database for all remaining steps
 *
 * We manually patch the step's parameter's so that it contains the new 'filters' field.
 * this ensures that the 'filters' field is automatically populated when we move to this.
 *
 * We also update $.step.parameters in memory so that the filters are automatically populated
 * in the ExecutionStep's dataIn when the test run is executed.
 */
const patchParameters = async ($: IGlobalVariable) => {
  try {
    // Transform in memory - add filters
    $.step.parameters.filters = [
      {
        lookupColumn: $.step.parameters.lookupColumn,
        lookupValue: $.step.parameters.lookupValue,
      },
    ]

    // Persist to database
    await Step.query()
      .patch({ parameters: $.step.parameters })
      .where({ 'steps.id': $.step.id })
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
