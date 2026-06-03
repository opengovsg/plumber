import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

/**
 * Friendly labels for this action's outputs, shown in the variable picker.
 * Without this, users see raw keys like `result` / `summary`.
 *
 * The three operations share one action but emit different outputs:
 * - compare / gap → a true/false `result` + a readable `summary`
 * - calculate     → a numeric `result` + `absolute` + `unit` + `summary`
 * We tell them apart by the presence of the `unit` key in `dataOut`.
 */
async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep
  if (!dataOut) {
    return null
  }

  const isCalculation = 'unit' in dataOut

  if (isCalculation) {
    return {
      result: {
        label: 'Difference (whole number; negative if the second date is earlier)',
        order: 1,
      },
      absolute: { label: 'Difference, ignoring direction', order: 2 },
      unit: { label: 'Unit', order: 3 },
      summary: { label: 'In words', order: 4 },
    }
  }

  return {
    // true / false, designed to be used in an "If... then" step.
    result: { label: 'Answer (true / false)', order: 1 },
    summary: { label: 'In words', order: 2 },
  }
}

export default getDataOutMetadata
