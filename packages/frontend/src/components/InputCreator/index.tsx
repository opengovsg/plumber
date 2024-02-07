import type { IField, IFieldDropdownOption } from '@plumber/types'

import * as React from 'react'
import MuiTextField from '@mui/material/TextField'
import ControlledAutocomplete from 'components/ControlledAutocomplete'
import MultiRow from 'components/MultiRow'
import MultiSelect from 'components/MultiSelect'
import RichTextEditor from 'components/RichTextEditor'
import TextField from 'components/TextField'
import useDynamicData from 'hooks/useDynamicData'

export type InputCreatorProps = {
  schema: IField
  namePrefix?: string
  stepId?: string
  disabled?: boolean
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
  const { schema, namePrefix, stepId, disabled } = props

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
        showOptionValue={schema.showOptionValue ?? true}
        label={label}
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
          variablesEnabled
        />
      )
    }

    return (
      <TextField
        defaultValue={value}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
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

  if (type === 'multirow') {
    return (
      <MultiRow
        name={computedName}
        label={label}
        description={description}
        subFields={schema.subFields}
        required={required}
        // These are InputCreatorProps which MultiRow will forward.
        stepId={stepId}
        disabled={disabled}
      />
    )
  }

  return <React.Fragment />
}
