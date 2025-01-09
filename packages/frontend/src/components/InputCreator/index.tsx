import type { IField, IFieldDropdownOption } from '@plumber/types'

import ControlledAutocomplete from '@/components/ControlledAutocomplete'
import DragDropInput from '@/components/DragDropInput'
import MultiRow from '@/components/MultiRow'
import MultiSelect from '@/components/MultiSelect'
import RichTextEditor from '@/components/RichTextEditor'
import TextField from '@/components/TextField'
import { useIsFieldHidden } from '@/helpers/isFieldHidden'
import useDynamicData from '@/hooks/useDynamicData'

import BooleanRadio from './BooleanRadio'

export type InputCreatorProps = {
  schema: IField
  namePrefix?: string
  stepId?: string
  disabled?: boolean
  parentType?: string
}

type RawOption = {
  name: string
  value: string
}

const optionGenerator = (options: RawOption[]): IFieldDropdownOption[] =>
  options?.map(({ name, value }) => ({ label: name as string, value: value }))

export default function InputCreator(props: InputCreatorProps): JSX.Element {
  const { schema, namePrefix, stepId, disabled, parentType } = props

  const {
    key: name,
    label,
    required,
    readOnly = false,
    value,
    description,
    clickToCopy,
    variables,
    type,
    placeholder,
  } = schema

  const computedName = namePrefix ? `${namePrefix}.${name}` : name
  const { data, loading, refetch } = useDynamicData(
    stepId,
    schema,
    computedName,
  )

  // NOTE: we handle visibility in InputCreator instead of in FlowSubStep
  // because MultiRow recursively renders InputCreator.
  const isHidden = useIsFieldHidden(namePrefix, schema)
  if (isHidden) {
    return <></>
  }

  if (type === 'boolean-radio') {
    return (
      <BooleanRadio
        name={computedName}
        label={label}
        description={description}
        required={required}
        defaultValue={value as boolean}
        options={schema?.options}
      />
    )
  }

  if (type === 'dragdrop') {
    return (
      <DragDropInput
        description={description}
        label={label}
        name={computedName}
        required={required}
        autoComplete={schema.autoComplete}
        placeholder={schema.placeholder}
      />
    )
  }

  if (type === 'dropdown') {
    const preparedOptions = schema.options || optionGenerator(data)
    return (
      <ControlledAutocomplete
        isSearchable={schema.isSearchable ?? true}
        name={computedName}
        required={required}
        freeSolo={schema.allowArbitrary}
        options={preparedOptions}
        defaultValue={value as string}
        description={description}
        loading={loading}
        // if schema source is defined, dynamic data is supported
        onRefresh={schema.source ? () => refetch() : undefined}
        showOptionValue={schema.showOptionValue ?? true}
        addNewOption={schema.addNewOption}
        label={label}
        placeholder={placeholder}
      />
    )
  }

  if (type === 'rich-text') {
    return (
      <RichTextEditor
        name={computedName}
        required={required}
        label={label}
        description={description}
        disabled={disabled}
        placeholder={placeholder}
        variablesEnabled={variables}
        isRich
      />
    )
  }

  if (type === 'string' || type === 'multiline') {
    if (variables) {
      return (
        <RichTextEditor
          name={computedName}
          required={required}
          label={label}
          description={description}
          disabled={disabled}
          placeholder={placeholder}
          isSingleLine={parentType === 'multicol'}
          variablesEnabled
        />
      )
    }

    return (
      <TextField
        required={required}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        name={computedName}
        label={label}
        multiline={type === 'multiline'}
        description={description}
        clickToCopy={clickToCopy}
      />
    )
  }

  if (type === 'multiselect') {
    return (
      <MultiSelect
        name={computedName}
        label={label}
        description={description}
        variableTypes={schema.variableTypes}
        placeholder={placeholder}
      />
    )
  }

  if (type === 'multirow' || type === 'multirow-multicol') {
    return (
      <MultiRow
        name={computedName}
        label={label}
        description={description}
        subFields={schema.subFields}
        required={required}
        addRowButtonText={schema.addRowButtonText}
        showDivider={type !== 'multirow-multicol'}
        type={type}
        // These are InputCreatorProps which MultiRow will forward.
        stepId={stepId}
        disabled={disabled}
      />
    )
  }

  return <></>
}
