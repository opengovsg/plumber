import type { IField, IFieldDropdownOption } from '@plumber/types'

import * as React from 'react'
import MuiTextField from '@mui/material/TextField'
import ControlledAutocomplete from 'components/ControlledAutocomplete'
import MultiSelect from 'components/MultiSelect'
import PowerInput from 'components/PowerInput'
import TextField from 'components/TextField'
import useDynamicData from 'hooks/useDynamicData'

type InputCreatorProps = {
  onChange?: React.ChangeEventHandler
  onBlur?: React.FocusEventHandler
  schema: IField
  namePrefix?: string
  stepId?: string
  disabled?: boolean
  showOptionValue?: boolean
}

type RawOption = {
  name: string
  value: string
}

const optionGenerator = (options: RawOption[]): IFieldDropdownOption[] =>
  options?.map(({ name, value }) => ({ label: name as string, value: value }))

export default function InputCreator(
  props: InputCreatorProps,
): React.ReactElement {
  const {
    onChange,
    onBlur,
    schema,
    namePrefix,
    stepId,
    disabled,
    showOptionValue,
  } = props

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
    dependsOn,
  } = schema

  const { data, loading, refetch } = useDynamicData(stepId, schema)
  const computedName = namePrefix ? `${namePrefix}.${name}` : name

  if (type === 'dropdown') {
    const preparedOptions = schema.options || optionGenerator(data)
    return (
      <ControlledAutocomplete
        name={computedName}
        dependsOn={dependsOn}
        fullWidth
        disablePortal
        required={required}
        freeSolo={schema.allowArbitrary}
        options={preparedOptions}
        renderInput={(params) => (
          <MuiTextField placeholder={placeholder} {...params} />
        )}
        defaultValue={value as string}
        description={description}
        loading={loading}
        // if schema source is defined, dynamic data is supported
        onRefresh={schema.source ? () => refetch() : undefined}
        disabled={disabled}
        showOptionValue={showOptionValue}
        label={label}
      />
    )
  }

  if (type === 'string' || type === 'multiline') {
    if (variables) {
      return (
        <PowerInput
          label={label}
          description={description}
          name={computedName}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
        />
      )
    }

    return (
      <TextField
        defaultValue={value}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        onChange={onChange}
        onBlur={onBlur}
        name={computedName}
        size="small"
        label={label}
        fullWidth
        multiline={type === 'multiline'}
        description={description}
        clickToCopy={clickToCopy}
        autoComplete={schema.autoComplete}
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

  return <React.Fragment />
}
