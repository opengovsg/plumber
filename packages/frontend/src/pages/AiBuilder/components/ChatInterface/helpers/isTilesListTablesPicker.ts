import type { DynamicPickerData } from '@/hooks/useChatStream'

/**
 * Excel also uses the listTables dynamic-data key for workbook tables.
 * Create-new is Tiles-only, so match on the step's app as well as the key.
 */
export function isTilesListTablesPicker(
  picker: DynamicPickerData,
  steps: Array<{ id: string; appKey?: string | null }>,
): boolean {
  if ('appKey' in picker || picker.key !== 'listTables') {
    return false
  }
  return steps.some(
    (step) => step.id === picker.stepId && step.appKey === 'tiles',
  )
}
