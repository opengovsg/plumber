import type { IFieldDropdownOption } from '@plumber/types'

import { useEffect, useMemo, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { Box, Flex, FormControl } from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'
import { ComboboxItem, SingleSelect } from 'components/SingleSelect'

interface ControlledAutocompleteProps {
  options: IFieldDropdownOption[]
  defaultValue?: string
  loading: boolean
  freeSolo?: boolean
  name: string
  label?: string
  showOptionValue?: boolean
  description?: string
  dependsOn?: string[]
  onRefresh?: () => void
  required?: boolean
  placeholder?: string
}

const formComboboxOptions = (
  options: readonly IFieldDropdownOption[],
  showOptionValue?: boolean,
) => {
  const result: ComboboxItem[] = []
  for (const option of options) {
    const item = {
      value:
        typeof option['value'] === 'number'
          ? JSON.stringify(option['value']) // Only stringify numbers
          : option['value'],
      // Display value if label does not exist
      label: option['label'] ?? (option.value?.toString() || ''),
      // Always hide value if description is availble.
      description:
        option['description'] ?? (showOptionValue ? option['value'] : ''),
    } as ComboboxItem
    result.push(item)
  }
  return result
}

const getSingleSelectOption = (
  options: readonly IFieldDropdownOption[],
  value: string,
  freeSolo?: boolean,
): string => {
  const foundOption = options.find((option) => option.value === value)
  // If allowArbitrary is true, return the value as the option
  if (freeSolo) {
    return value
  }
  return foundOption?.value.toString() ?? ''
}

function ControlledAutocomplete(
  props: ControlledAutocompleteProps,
): React.ReactElement {
  const { control, watch, setValue, resetField } = useFormContext()
  const {
    name,
    label,
    defaultValue,
    description,
    options = [],
    dependsOn = [],
    showOptionValue,
    freeSolo,
    onRefresh,
    loading,
    required,
    placeholder,
  } = props

  const dependsOnValues: unknown[] = useMemo(
    () => (dependsOn?.length ? watch(dependsOn) : []),
    [dependsOn, watch],
  )

  // This is added to add custom dropdown options when freeSolo is enabled
  const [sessionOptions, setSessionOptions] = useState(options)

  useEffect(() => {
    const hasDependencies = dependsOnValues.length
    const allDepsSatisfied = dependsOnValues.every(Boolean)

    if (hasDependencies && !allDepsSatisfied) {
      // Reset the field if any dependency is not satisfied
      setValue(name, null)
      resetField(name)
    }

    if (freeSolo) {
      // allow for custom fields to be added temporarily when allowArbitrary is set to true
      if (sessionOptions.length === 0) {
        setSessionOptions(options)
      }
    } else {
      // dynamically update and refresh the next set of fields
      if (sessionOptions !== options) {
        setSessionOptions(options)
      }
    }
  }, [
    dependsOnValues,
    name,
    resetField,
    setValue,
    options,
    sessionOptions,
    freeSolo,
  ])

  return (
    <Controller
      rules={{ required }}
      name={name}
      defaultValue={defaultValue ?? ''}
      control={control}
      render={({ field: { ref, onChange, ...field }, fieldState }) => {
        const isError = Boolean(fieldState.isTouched && fieldState.error)

        return (
          <FormControl isInvalid={isError}>
            {label && (
              <FormLabel
                isRequired={required}
                description={
                  description && (
                    <Markdown linkTarget="_blank">{description}</Markdown>
                  )
                }
              >
                {label}
              </FormLabel>
            )}
            {/* Dropdown row option content */}
            <Flex>
              <Box flexGrow={1}>
                <SingleSelect
                  name="choose-dropdown-option"
                  colorScheme="secondary"
                  isClearable={!required}
                  items={formComboboxOptions(sessionOptions, showOptionValue)}
                  onChange={(selectedOption) => {
                    // SingleSelect requires the value to be a string so only parse "numbers" into a string
                    if (
                      freeSolo ||
                      selectedOption === '' ||
                      isNaN(Number(selectedOption))
                    ) {
                      onChange(selectedOption)
                    } else {
                      onChange(JSON.parse(selectedOption))
                    }
                  }}
                  value={getSingleSelectOption(
                    sessionOptions,
                    field.value,
                    freeSolo,
                  )}
                  placeholder={placeholder}
                  ref={ref}
                  data-test={`${name}-autocomplete`}
                  onRefresh={onRefresh}
                  isRefreshLoading={loading}
                  freeSolo={freeSolo}
                  addCustomOption={(selectedOption) => {
                    setSessionOptions([
                      ...sessionOptions,
                      {
                        label: selectedOption,
                        value: selectedOption,
                        description: selectedOption,
                      },
                    ])
                  }}
                />
              </Box>
            </Flex>
            {isError && (
              <FormErrorMessage>{fieldState.error?.message}</FormErrorMessage>
            )}
          </FormControl>
        )
      }}
    />
  )
}

export default ControlledAutocomplete
