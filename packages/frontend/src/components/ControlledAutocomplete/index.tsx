import type { IFieldDropdown, IFieldDropdownOption } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { Box, Flex, FormControl, useDisclosure } from '@chakra-ui/react'
import {
  BxPlus,
  FormErrorMessage,
  FormLabel,
} from '@opengovsg/design-system-react'
import { ComboboxItem, SingleSelect } from 'components/SingleSelect'

import AddNewOptionModal from './AddNewOptionModal'

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

const ADD_NEW_MODAL_VALUE = 'ADD_NEW_MODAL_VALUE'

const formComboboxOptions = (
  options: readonly IFieldDropdownOption[],
  showOptionValue?: boolean,
  addNewLabel?: string,
) => {
  const result: ComboboxItem[] = []
  if (addNewLabel) {
    result.push({
      value: ADD_NEW_MODAL_VALUE,
      label: addNewLabel,
      icon: BxPlus,
    })
  }
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
    addNewOption,
  } = props

  const items = useMemo(
    () =>
      formComboboxOptions(
        options,
        showOptionValue,
        addNewOption?.type === 'modal' ? addNewOption?.label : undefined,
      ),
    [addNewOption, options, showOptionValue],
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
   * so that we could wrap the onChange handler
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

  const onChange = useCallback(
    (newValue?: string) => {
      if (addNewOption && newValue === ADD_NEW_MODAL_VALUE) {
        onNewOptionModalOpen()
        return
      }
      fieldOnChange(newValue)
    },
    [addNewOption, fieldOnChange, onNewOptionModalOpen],
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
      {isError && <FormErrorMessage>{error?.message}</FormErrorMessage>}
      {addNewOption?.type === 'modal' && isNewOptionModalOpen && (
        <AddNewOptionModal
          addNewOption={addNewOption}
          onClose={onNewOptionModalClose}
          onSubmit={fieldOnChange}
        />
      )}
    </FormControl>
  )
}

export default ControlledAutocomplete
