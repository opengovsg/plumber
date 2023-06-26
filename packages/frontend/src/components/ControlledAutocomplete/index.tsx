import type { IFieldDropdownOption } from '@plumber/types'

import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Autocomplete, { AutocompleteProps } from '@mui/material/Autocomplete'
import FormHelperText from '@mui/material/FormHelperText'
import Typography from '@mui/material/Typography'

interface ControlledAutocompleteProps
  extends AutocompleteProps<IFieldDropdownOption, boolean, boolean, boolean> {
  shouldUnregister?: boolean
  name: string
  required?: boolean
  showOptionValue?: boolean
  description?: string
  dependsOn?: string[]
}

const getOption = (
  options: readonly IFieldDropdownOption[],
  value: string,
  freeSolo?: boolean,
) => {
  const foundOption = options.find((option) => option.value === value)
  if (foundOption) {
    return foundOption
  }
  // If allowArbitrary is true, return the value as the option
  if (freeSolo) {
    return value
  }
  return null
}

function ControlledAutocomplete(
  props: ControlledAutocompleteProps,
): React.ReactElement {
  const { control, watch, setValue, resetField } = useFormContext()

  const {
    required = false,
    name,
    defaultValue,
    shouldUnregister,
    onBlur,
    onChange,
    description,
    options = [],
    dependsOn = [],
    showOptionValue,
    freeSolo,
    ...autocompleteProps
  } = props

  let dependsOnValues: unknown[] = []
  if (dependsOn?.length) {
    dependsOnValues = watch(dependsOn)
  }

  React.useEffect(() => {
    const hasDependencies = dependsOnValues.length
    const allDepsSatisfied = dependsOnValues.every(Boolean)

    if (hasDependencies && !allDepsSatisfied) {
      // Reset the field if any dependency is not satisfied
      setValue(name, null)
      resetField(name)
    }
  }, dependsOnValues)

  return (
    <Controller
      rules={{ required }}
      name={name}
      defaultValue={defaultValue || ''}
      control={control}
      shouldUnregister={shouldUnregister}
      render={({
        field: {
          ref,
          onChange: controllerOnChange,
          onBlur: controllerOnBlur,
          ...field
        },
        fieldState,
      }) => (
        <div>
          {/* encapsulated with an element such as div to vertical spacing delegated from parent */}
          <Autocomplete
            {...autocompleteProps}
            {...field}
            freeSolo={freeSolo}
            options={options}
            value={getOption(options, field.value, freeSolo)}
            onInputChange={(_event, value) => {
              controllerOnChange(value)
            }}
            onChange={(event, selectedOption, reason, details) => {
              const typedSelectedOption = selectedOption as IFieldDropdownOption
              if (
                typedSelectedOption !== null &&
                Object.prototype.hasOwnProperty.call(
                  typedSelectedOption,
                  'value',
                )
              ) {
                controllerOnChange(typedSelectedOption.value)
              } else {
                controllerOnChange(typedSelectedOption)
              }
              // onChange does nothing since it's not passed in
              onChange?.(event, selectedOption, reason, details)
            }}
            onBlur={(...args) => {
              controllerOnBlur()
              onBlur?.(...args)
            }}
            ref={ref}
            data-test={`${name}-autocomplete`}
            renderOption={(optionProps, option) => (
              <li
                {...optionProps}
                key={option.value.toString()}
                style={{ flexDirection: 'column', alignItems: 'start' }}
              >
                <Typography>{option.label}</Typography>

                {showOptionValue && (
                  <Typography variant="caption">{option.value}</Typography>
                )}
              </li>
            )}
          />

          <FormHelperText
            variant="outlined"
            error={Boolean(fieldState.isTouched && fieldState.error)}
          >
            {fieldState.isTouched
              ? fieldState.error?.message || description
              : description}
          </FormHelperText>
        </div>
      )}
    />
  )
}

export default ControlledAutocomplete
