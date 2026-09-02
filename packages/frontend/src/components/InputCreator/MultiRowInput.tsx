import type {
  IField,
  IFieldDropdown,
  IFieldDropdownOption,
  IJSONValue,
} from '@plumber/types'

import MultiRow from '@/components/MultiRow'
import { shouldHideEmptySourceDropdown } from '@/helpers/isFieldHidden'
import useDynamicData from '@/hooks/useDynamicData'

type RawOption = {
  name: string
  value: string
}

const optionGenerator = (options: RawOption[]): IFieldDropdownOption[] =>
  options?.map(({ name, value }) => ({ label: name as string, value: value }))

type MultiRowInputProps = {
  schema: IField & { subFields: IField[]; addRowButtonText?: string }
  computedName: string
  stepId?: string
  maxRows?: number
  defaultValue?: string | IJSONValue
  // See IFieldMultiRowMultiCol.autofillable.
  autofillable?: boolean
  // See IFieldMultiRowMultiCol.maxAutofillOptions.
  maxAutofillOptions?: number
}

/**
 * Renders a multirow field and hides the entire block when its first
 * source-backed subfield with hideWhenNoOptions resolves to zero options.
 */
export default function MultiRowInput(props: MultiRowInputProps): JSX.Element {
  const {
    schema,
    computedName,
    stepId,
    maxRows,
    defaultValue,
    autofillable,
    maxAutofillOptions,
  } = props
  const { label, required, description, subFields, addRowButtonText } = schema
  const type = schema.type

  const hideProbeSubField = subFields.find(
    (subField): subField is IFieldDropdown =>
      subField.type === 'dropdown' &&
      !!subField.hideWhenNoOptions &&
      !!subField.source,
  )

  const { data, loading } = useDynamicData(
    stepId,
    hideProbeSubField ?? schema,
    hideProbeSubField
      ? `${computedName}.0.${hideProbeSubField.key}`
      : computedName,
  )

  if (hideProbeSubField) {
    const preparedOptions =
      hideProbeSubField.options || optionGenerator(data as RawOption[])
    if (
      shouldHideEmptySourceDropdown(hideProbeSubField, preparedOptions, loading)
    ) {
      return <></>
    }
  }

  return (
    <MultiRow
      name={computedName}
      label={label}
      description={description}
      subFields={subFields}
      required={required}
      addRowButtonText={addRowButtonText}
      showDivider={type !== 'multirow-multicol'}
      type={type}
      stepId={stepId}
      maxRows={maxRows}
      defaultValue={defaultValue}
      autofillable={autofillable}
      maxAutofillOptions={maxAutofillOptions}
    />
  )
}
