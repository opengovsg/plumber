import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

/**
 * Friendly labels for this action's outputs, shown in the variable picker.
 * Without this, users see raw keys like `result` / `absolute`.
 *
 * The three operations share one action but emit different outputs:
 * - compare / gap → a true/false `result`
 * - calculate     → a numeric `result` + `absolute` + `unit`
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
        label: 'Time difference (negative if second date is earlier)',
        order: 1,
      },
      absolute: { label: 'Time difference (always positive)', order: 2 },
      unit: { label: 'Unit (e.g. days, weeks)', order: 3 },
    }
  }

  return {
    result: { label: 'Answer (true / false)', order: 1 },
  }
}

export default getDataOutMetadata
