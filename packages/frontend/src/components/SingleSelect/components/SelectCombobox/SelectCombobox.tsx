import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Flex,
  Icon,
  InputGroup,
  Stack,
  Text,
  useMergeRefs,
} from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'

import { useSelectContext } from '../../SelectContext'
import { itemToIcon, itemToLabelString } from '../../utils/itemUtils'

import { ComboboxClearButton } from './ComboboxClearButton'
import { ToggleChevron } from './ToggleChevron'

export const SelectCombobox = forwardRef<HTMLInputElement>(
  (_props, ref): JSX.Element => {
    const {
      toggleMenu,
      selectedItem,
      getInputProps,
      styles,
      isDisabled,
      isSearchable,
      isReadOnly,
      isInvalid,
      inputValue,
      isRequired,
      placeholder,
      isRefreshLoading,
      isCreatingNewOption,
      isOpen,
      resetInputValue,
      inputRef,
      isClearable,
      size,
    } = useSelectContext()

    const mergedInputRef = useMergeRefs(inputRef, ref)

    const [hasOptionsLoadedOnce, setHasOptionsLoadedOnce] = useState(false)
    const isInitialLoading = !hasOptionsLoadedOnce && isRefreshLoading

    useEffect(() => {
      if (!isRefreshLoading) {
        setHasOptionsLoadedOnce(true)
      }
    }, [isRefreshLoading])

    const selectedItemMeta = useMemo(
      () => ({
        icon: itemToIcon(selectedItem),
        label: itemToLabelString(selectedItem),
      }),
      [selectedItem],
    )

    const handleToggleMenu = useCallback(() => {
      if (isReadOnly || isDisabled) {
        return
      }
      return toggleMenu()
    }, [isDisabled, isReadOnly, toggleMenu])

    const textToDisplay = useMemo(() => {
      if (isInitialLoading) {
        return 'Fetching options...'
      }
      if (isCreatingNewOption) {
        return 'Creating...'
      }
      if (selectedItem) {
        return selectedItemMeta.label
      }
      return ''
    }, [
      isCreatingNewOption,
      isInitialLoading,
      selectedItem,
      selectedItemMeta.label,
    ])

    return (
      <Flex>
        <InputGroup
          size={size}
          pos="relative"
          display="grid"
          marginInlineEnd={isClearable ? '-1px' : undefined}
          _focusWithin={{
            zIndex: 1,
          }}
          gridTemplateColumns="1fr"
        >
          <Stack
            visibility={inputValue || isInitialLoading ? 'hidden' : 'initial'}
            direction="row"
            spacing="1rem"
            aria-disabled={isDisabled}
            sx={styles.selected}
            aria-hidden
          >
            {selectedItemMeta.icon ? (
              <Icon
                sx={styles.icon}
                as={selectedItemMeta.icon}
                aria-disabled={isDisabled}
              />
            ) : null}
            <Text noOfLines={1}>{textToDisplay}</Text>
          </Stack>
          <Input
            isReadOnly={!isSearchable || isReadOnly}
            isInvalid={isInvalid}
            isDisabled={isDisabled}
            placeholder={textToDisplay ? '' : placeholder}
            sx={styles.field}
            {...getInputProps({
              onClick: handleToggleMenu,
              onBlur: () => !isOpen && resetInputValue(),
              ref: mergedInputRef,
              disabled: isDisabled,
              readOnly: isReadOnly,
              required: isRequired,
              'aria-expanded': !!isOpen,
            })}
          />
          <ToggleChevron />
        </InputGroup>
        <ComboboxClearButton />
      </Flex>
    )
  },
)

SelectCombobox.displayName = 'SelectCombobox'
