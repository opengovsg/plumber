import type { IField } from '@plumber/types'

import { RefObject, useCallback, useRef } from 'react'
import { useDisclosure } from '@chakra-ui/react'

import useDynamicData from '@/hooks/useDynamicData.js'

export type AutofillConfirmState = {
  isOpen: boolean
  cancelRef: RefObject<HTMLButtonElement>
  onClose: () => void
  onConfirm: () => void
}

export type UseAutofillResult = {
  // Whether the "Autofill" button should render at all for this field.
  canAutofill: boolean
  isLoading: boolean
  // Count of options currently available from subFields[0]'s dynamic-data
  // source
  optionCount: number | undefined
  // Click handler for the "Autofill" button itself: applies immediately if
  // every row is still empty, otherwise opens the confirm dialog.
  onAutofillClick: () => void
  confirm: AutofillConfirmState
}

type UseAutofillArgs = {
  // Whether the field schema opted into Autofill (see IFieldMultiRowMultiCol.autofillable).
  autofillable: boolean | undefined
  type: string | undefined
  subFields: IField[]
  stepId: string | undefined
  name: string
  newRowDefaultValue: Record<string, unknown>
  replace: (rows: Record<string, unknown>[]) => void
  getValues: (name: string) => unknown
  setValue: (
    name: string,
    value: unknown,
    opts: { shouldDirty: boolean; shouldValidate: boolean },
  ) => void
}

const rowHasValue = (row: Record<string, unknown>) =>
  Object.entries(row).some(
    ([key, value]) => key !== 'id' && value != null && value !== '',
  )

/**
 * Bulk-populates a multirow-multicol field's rows straight from the
 * dynamic-data options of its first sub-field (e.g. GatherSG's case field
 * list), instead of the user adding rows one at a time. Row keys are derived
 * generically from `subFields` so this works for any multirow-multicol
 * consumer that opts in via `autofillable`, not just GatherSG.
 */
export default function useAutofill({
  autofillable,
  type,
  subFields,
  stepId,
  name,
  newRowDefaultValue,
  replace,
  getValues,
  setValue,
}: UseAutofillArgs): UseAutofillResult {
  const canAutofill =
    !!autofillable &&
    type === 'multirow-multicol' &&
    subFields?.[0]?.type === 'dropdown' &&
    !!subFields[0].source

  const {
    data: dynamicDataOptions,
    loading: isLoading,
    refetch,
  } = useDynamicData(stepId, subFields?.[0], name)

  const optionCount = dynamicDataOptions?.length

  const buildAutofillRows = useCallback(
    (items: { value: string; type?: string }[]) =>
      items.map((item) => ({
        ...newRowDefaultValue,
        [subFields[0].key]: item.value,
        ...(subFields[1] && item.type ? { [subFields[1].key]: item.type } : {}),
      })),
    [newRowDefaultValue, subFields],
  )

  const applyAutofill = useCallback(async () => {
    const { data: refetchedData } = await refetch()
    replace(buildAutofillRows(refetchedData?.getDynamicData ?? []))
    // A nested useFieldArray's `replace` updates the form value but does not
    // fire the form's `watch` subject, so subscribers such as the step
    // validator gating "Check step" never recompute. Re-assert the
    // already-updated value through `setValue`, which does notify.
    setValue(name, getValues(name), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [refetch, buildAutofillRows, replace, setValue, getValues, name])

  const {
    isOpen: isConfirmOpen,
    onOpen: onConfirmOpen,
    onClose: onConfirmClose,
  } = useDisclosure()
  const confirmCancelRef = useRef<HTMLButtonElement>(null)

  const onAutofillClick = useCallback(() => {
    if (isLoading) {
      return
    }
    const currentRows = (getValues(name) as Record<string, unknown>[]) ?? []
    if (currentRows.some(rowHasValue)) {
      onConfirmOpen()
      return
    }
    applyAutofill()
  }, [isLoading, getValues, name, onConfirmOpen, applyAutofill])

  const onAutofillConfirm = useCallback(() => {
    onConfirmClose()
    applyAutofill()
  }, [onConfirmClose, applyAutofill])

  return {
    canAutofill,
    isLoading,
    optionCount,
    onAutofillClick,
    confirm: {
      isOpen: isConfirmOpen,
      cancelRef: confirmCancelRef,
      onClose: onConfirmClose,
      onConfirm: onAutofillConfirm,
    },
  }
}
