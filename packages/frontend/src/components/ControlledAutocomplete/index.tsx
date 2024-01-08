import type { IFieldDropdownOption } from '@plumber/types'

import { useEffect, useMemo } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { BiRefresh } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { Flex, FormControl } from '@chakra-ui/react'
import { Paper, PaperProps, TextField } from '@mui/material'
import Autocomplete, {
  AutocompleteProps,
  createFilterOptions,
} from '@mui/material/Autocomplete'
import Typography from '@mui/material/Typography'
import {
  Button,
  FormErrorMessage,
  FormLabel,
  Spinner,
} from '@opengovsg/design-system-react'

interface PaperWithRefreshProps extends PaperProps {
  onRefresh?: () => void
  loading?: boolean
}

function PaperWithRefresh(props: PaperWithRefreshProps): JSX.Element {
  const { onRefresh, loading, children, ...paperProps } = props
  return (
    <Paper {...paperProps}>
      {children}
      {onRefresh && (
        <Button
          leftIcon={<BiRefresh />}
          w="100%"
          variant="clear"
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          spinner={<Spinner fontSize={24} color="primary.600" />}
          onClick={onRefresh}
          isLoading={loading}
        >
          Refresh items
        </Button>
      )}
    </Paper>
  )
}

interface ControlledAutocompleteProps
  extends AutocompleteProps<IFieldDropdownOption, boolean, boolean, boolean> {
  shouldUnregister?: boolean
  name: string
  label?: string
  showOptionValue?: boolean
  description?: string
  dependsOn?: string[]
  onRefresh?: () => void
  required?: boolean
}

const filter = createFilterOptions<IFieldDropdownOption>()

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
    name,
    label,
    defaultValue,
    shouldUnregister,
    description,
    options = [],
    dependsOn = [],
    showOptionValue,
    freeSolo,
    onRefresh,
    loading,
    required,
    ...autocompleteProps
  } = props

  const dependsOnValues: unknown[] = useMemo(
    () => (dependsOn?.length ? watch(dependsOn) : []),
    [dependsOn, watch],
  )

  useEffect(() => {
    const hasDependencies = dependsOnValues.length
    const allDepsSatisfied = dependsOnValues.every(Boolean)

    if (hasDependencies && !allDepsSatisfied) {
      // Reset the field if any dependency is not satisfied
      setValue(name, null)
      resetField(name)
    }
  }, [dependsOnValues, name, resetField, setValue])

  return (
    <Controller
      rules={{ required }}
      name={name}
      defaultValue={defaultValue || ''}
      control={control}
      shouldUnregister={shouldUnregister}
      render={({ field: { ref, onChange, onBlur, ...field }, fieldState }) => {
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
            {/* encapsulated with an element such as div to vertical spacing delegated from parent */}
            <Flex alignItems="center" gap={2}>
              <Autocomplete
                {...autocompleteProps}
                {...field}
                disableClearable={required}
                freeSolo={freeSolo}
                options={options}
                value={getOption(options, field.value, freeSolo)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loading && (
                            <Spinner fontSize={24} color="primary.600" />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                onChange={(_event, selectedOption) => {
                  const typedSelectedOption =
                    selectedOption as IFieldDropdownOption
                  if (
                    typedSelectedOption !== null &&
                    Object.prototype.hasOwnProperty.call(
                      typedSelectedOption,
                      'value',
                    )
                  ) {
                    onChange(typedSelectedOption.value)
                    return
                  }
                  // manual input
                  onChange(typedSelectedOption)
                }}
                onBlur={onBlur}
                clearOnBlur
                filterOptions={(options, params) => {
                  const filtered = filter(options, params)

                  if (freeSolo && params.inputValue !== '') {
                    filtered.push({
                      value: params.inputValue,
                      label: `Use: ${params.inputValue}`,
                    })
                  }

                  return filtered
                }}
                ref={ref}
                data-test={`${name}-autocomplete`}
                getOptionLabel={(option) => {
                  // manual input
                  if (typeof option === 'string') {
                    return option
                  }
                  if (option.label) {
                    return option.label
                  }
                  return option.value?.toString() || ''
                }}
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
                PaperComponent={(props) => (
                  <PaperWithRefresh
                    {...props}
                    onRefresh={onRefresh}
                    loading={loading}
                  />
                )}
              />
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
