import type { IFieldDropdownOption } from '@plumber/types'

import { useMemo } from 'react'
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
      value: option['value']?.toString(),
      // Display value if label does not exist
      label: option['label'] ?? (option.value?.toString() || ''),
      // Always hide value if description is availble.
      description:
        option['description'] ??
        (showOptionValue ? option['value'].toString() : ''),
    } satisfies ComboboxItem
    result.push(item)
  }
  return result
}

function ControlledAutocomplete(
  props: ControlledAutocompleteProps,
): React.ReactElement {
  const { control } = useFormContext()
  const {
    name,
    label,
    defaultValue,
    description,
    options = [],
    showOptionValue,
    freeSolo: rawFreeSolo,
    onRefresh,
    loading,
    required,
    placeholder,
  } = props

  const items = useMemo(
    () => formComboboxOptions(options, showOptionValue),
    [options, showOptionValue],
  )

  // Do not support freeSolo if there are numerical options. Since no use case
  // for it yet and it makes things more complex.
  const freeSolo = useMemo(() => {
    if (
      options.length &&
      options.every((option) => typeof option.value !== 'string')
    ) {
      return false
    }
    return rawFreeSolo
  }, [options, rawFreeSolo])

  return (
    <Controller
      rules={{ required }}
      name={name}
      defaultValue={defaultValue ?? ''}
      control={control}
      render={({ field: { ref, onChange, value: fieldValue }, fieldState }) => {
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
                  items={items}
                  onChange={onChange}
                  value={fieldValue}
                  placeholder={placeholder}
                  ref={ref}
                  data-test={`${name}-autocomplete`}
                  onRefresh={onRefresh}
                  isRefreshLoading={loading}
                  freeSolo={freeSolo}
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
