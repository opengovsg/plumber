import type { IFieldDropdown, IFieldDropdownOption } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { Box, Flex, FormControl, useDisclosure } from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'
import { ComboboxItem, SingleSelect } from 'components/SingleSelect'

import AddNewOptionModal, { useCreateNewOption } from './AddNewOptionModal'

export interface ControlledAutocompleteProps {
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
  addNewOption?: IFieldDropdown['addNewOption']
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
  const { control, getValues } = useFormContext()
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
    addNewOption,
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

  /**
   * useController is used here instead of the Controller component
   * so that we could call the onChange handler
   */
  const {
    field: { value: fieldValue, onChange: fieldOnChange, ref },
    fieldState: { isTouched, error },
  } = useController({
    name,
    control,
    rules: { required },
    defaultValue: defaultValue ?? '',
  })

  const isError = Boolean(isTouched && error)

  // Control add new option modal
  const {
    onClose: onNewOptionModalClose,
    onOpen: onNewOptionModalOpen,
    isOpen: isNewOptionModalOpen,
  } = useDisclosure()

  const { createNewOption, isCreatingNewOption } =
    useCreateNewOption(fieldOnChange)

  const onNewOptionModalSubmit = useCallback(
    (inputValue: string) => {
      onNewOptionModalClose()
      createNewOption({
        inputValue,
        addNewId: addNewOption?.id,
        parameters: getValues('parameters'),
      })
    },
    [addNewOption?.id, createNewOption, getValues, onNewOptionModalClose],
  )

  const onNewOptionInlineSelected = useCallback(
    (inputValue: string) => {
      createNewOption({
        inputValue,
        addNewId: addNewOption?.id,
        parameters: getValues('parameters'),
      })
    },
    [createNewOption, getValues, addNewOption?.id],
  )

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
            onChange={fieldOnChange}
            value={fieldValue}
            placeholder={placeholder}
            ref={ref}
            data-test={`${name}-autocomplete`}
            onRefresh={onRefresh}
            isRefreshLoading={loading}
            freeSolo={freeSolo}
            addNew={
              addNewOption
                ? {
                    type: addNewOption.type,
                    label: addNewOption.label,
                    onSelected:
                      addNewOption?.type === 'modal'
                        ? onNewOptionModalOpen
                        : onNewOptionInlineSelected,
                    isCreating: isCreatingNewOption,
                  }
                : undefined
            }
          />
        </Box>
      </Flex>
      {isError && <FormErrorMessage>{error?.message}</FormErrorMessage>}
      {addNewOption?.type === 'modal' && isNewOptionModalOpen && (
        <AddNewOptionModal
          modalHeader={addNewOption.label}
          onClose={onNewOptionModalClose}
          onSubmit={onNewOptionModalSubmit}
        />
      )}
    </FormControl>
  )
}

export default ControlledAutocomplete
