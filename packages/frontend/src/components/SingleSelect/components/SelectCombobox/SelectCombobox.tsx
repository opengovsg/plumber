import { forwardRef, useCallback, useMemo } from 'react'
import {
  Flex,
  Icon,
  InputGroup,
  Stack,
  Text,
  useMergeRefs,
} from '@chakra-ui/react'
import { Badge, Input } from '@opengovsg/design-system-react'

import { useSelectContext } from '../../SelectContext'
import {
  isItemInstant,
  itemToIcon,
  itemToLabelString,
} from '../../utils/itemUtils'

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
      isOpen,
      resetInputValue,
      inputRef,
      isClearable,
      size,
      value,
    } = useSelectContext()

    const mergedInputRef = useMergeRefs(inputRef, ref)

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
            visibility={inputValue ? 'hidden' : 'initial'}
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
            {/* To display custom value if it exists when freeSolo is enabled */}
            <Flex w="100%" justifyContent="space-between">
              <Text noOfLines={1}>
                {selectedItemMeta.label !== '' ? selectedItemMeta.label : value}
              </Text>
              {isItemInstant(selectedItem) && (
                <Badge
                  bgColor="interaction.muted.main.active"
                  color="primary.600"
                >
                  Instant
                </Badge>
              )}
            </Flex>
          </Stack>
          <Input
            isReadOnly={!isSearchable || isReadOnly}
            isInvalid={isInvalid}
            isDisabled={isDisabled}
            placeholder={selectedItem ? undefined : placeholder}
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
