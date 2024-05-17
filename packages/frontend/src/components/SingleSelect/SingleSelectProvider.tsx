import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import {
  FormControlOptions,
  ThemingProps,
  useFormControlProps,
  useMultiStyleConfig,
  useTheme,
} from '@chakra-ui/react'
import { useCombobox, UseComboboxProps } from 'downshift'

import { useItems } from './hooks/useItems'
import { defaultFilter } from './utils/defaultFilter'
import {
  isItemDisabled,
  itemToDescriptionString,
  itemToValue,
} from './utils/itemUtils'
import { VIRTUAL_LIST_ITEM_HEIGHT } from './constants'
import { SelectContext, SharedSelectContextReturnProps } from './SelectContext'
import { ComboboxItem } from './types'

export interface SingleSelectProviderProps<
  Item extends ComboboxItem = ComboboxItem,
> extends SharedSelectContextReturnProps<Item>,
    FormControlOptions {
  /** Controlled selected value */
  value: string
  /** Controlled selected item onChange handler */
  onChange: (value: string) => void
  /** Function based on which items in dropdown are filtered. Default filter filters by fuzzy match. */
  filter?(items: Item[], value: string): Item[]
  /** Initial dropdown opened state. */
  initialIsOpen?: boolean
  /** Props to override default useComboboxProps, if any. */
  comboboxProps?: Partial<UseComboboxProps<Item>>
  /** aria-describedby to be attached to the combobox input, if any. */
  inputAria?: {
    id: string
    label: string
  }
  children: React.ReactNode
  /** Color scheme of component */
  colorScheme?: ThemingProps<'SingleSelect'>['colorScheme']
  fixedItemHeight?: number
  /** SPECIAL CASE for Plumber:
   * Allow dropdown options to reload upon clicking refresh */
  onRefresh?: () => void
  isRefreshLoading?: boolean
  /** Allow custom dropdown option if freeSolo is enabled */
  freeSolo?: boolean
  addCustomOption?: (newValue: string) => void
}
export const SingleSelectProvider = ({
  items: rawItems,
  value,
  onChange,
  name,
  filter = defaultFilter,
  nothingFoundLabel = 'No matching results',
  placeholder: placeholderProp,
  clearButtonLabel = 'Clear selection',
  isClearable = true,
  isSearchable = true,
  initialIsOpen,
  isInvalid: isInvalidProp,
  isReadOnly: isReadOnlyProp,
  isDisabled: isDisabledProp,
  isRequired: isRequiredProp,
  children,
  inputAria,
  colorScheme,
  size: _size,
  comboboxProps = {},
  fixedItemHeight,
  onRefresh,
  isRefreshLoading,
  freeSolo,
  addCustomOption,
}: SingleSelectProviderProps): JSX.Element => {
  const theme = useTheme()
  // Required in case size is set in theme, we should respect the one set in theme.
  const size = useMemo(
    () =>
      (_size ?? theme?.components?.SingleSelect?.defaultProps?.size ?? 'md') as
        | 'xs'
        | 'sm'
        | 'md'
        | 'lg',
    [_size, theme?.components?.SingleSelect?.defaultProps?.size],
  )

  const { items, getItemByValue, addCustomItem } = useItems({ rawItems })
  const [isFocused, setIsFocused] = useState(false)

  const { isInvalid, isDisabled, isReadOnly, isRequired } = useFormControlProps(
    {
      isInvalid: isInvalidProp,
      isDisabled: isDisabledProp,
      isReadOnly: isReadOnlyProp,
      isRequired: isRequiredProp,
    },
  )

  const placeholder = useMemo(() => {
    if (placeholderProp === null) {
      return ''
    }
    return placeholderProp ?? 'Select an option'
  }, [placeholderProp])

  const getFilteredItems = useCallback(
    (filterValue?: string) =>
      filterValue ? filter(items, filterValue) : items,
    [filter, items],
  )
  const [filteredItems, setFilteredItems] = useState(
    getFilteredItems(
      comboboxProps.initialInputValue ?? comboboxProps.inputValue,
    ),
  )

  const memoizedSelectedItem = useMemo(() => {
    return getItemByValue(value)?.item ?? null
  }, [getItemByValue, value])

  const resetItems = useCallback(
    () => setFilteredItems(getFilteredItems()),
    [getFilteredItems],
  )

  const virtualListRef = useRef<VirtuosoHandle>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    toggleMenu,
    closeMenu,
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    getToggleButtonProps,
    highlightedIndex,
    selectItem,
    selectedItem,
    inputValue,
    setInputValue,
  } = useCombobox({
    labelId: `${name}-label`,
    inputId: name,
    defaultInputValue: '',
    defaultHighlightedIndex: 0,
    items: filteredItems,
    initialIsOpen,
    selectedItem: memoizedSelectedItem,
    itemToString: itemToValue,
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem || !isItemDisabled(selectedItem)) {
        onChange(itemToValue(selectedItem))
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    scrollIntoView: () => {},
    onHighlightedIndexChange: ({ highlightedIndex }) => {
      if (
        highlightedIndex !== undefined &&
        highlightedIndex >= 0 &&
        virtualListRef.current
      ) {
        virtualListRef.current.scrollIntoView({
          index: highlightedIndex,
        })
      }
    },
    onStateChange: ({ inputValue, type }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.FunctionSetInputValue:
        case useCombobox.stateChangeTypes.InputChange:
          setFilteredItems(getFilteredItems(inputValue))
          break
        default:
          return
      }
    },
    stateReducer: (state, { changes, type }) => {
      switch (type) {
        // Handle controlled `value` prop changes.
        case useCombobox.stateChangeTypes.ControlledPropUpdatedSelectedItem:
          // Do nothing if selectedItem is null but yet previous state has inputValue.
          // This suggests that there is some initial input state that we want to keep.
          // This can only happen on first mount, since inputValue will be empty string
          // on future actions.
          if (state.inputValue && !changes.selectedItem) {
            return { ...changes, inputValue: state.inputValue }
          }
          return {
            ...changes,
            // Clear inputValue on item selection
            inputValue: '',
          }
        case useCombobox.stateChangeTypes.InputKeyDownEscape: {
          if (isClearable) {
            return changes
          }
          return {
            ...changes,
            selectedItem: state.selectedItem,
          }
        }
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.InputBlur:
        case useCombobox.stateChangeTypes.ItemClick: {
          resetItems()

          // UPDATE: to add custom dropdown options
          if (freeSolo) {
            if (inputValue !== '' && getItemByValue(inputValue) === null) {
              // Sanity check: if freeSolo is enabled, the addCustomOption function must come together
              if (addCustomOption) {
                addCustomOption(inputValue) // To update the items array to be re-rendered
                // To render the option immediately
                addCustomItem(inputValue)
                selectItem(items[items.length - 1])
              }
            }
          }
          return {
            ...changes,
            // Clear inputValue on item selection
            inputValue: '',
            isOpen: false,
          }
        }
        case useCombobox.stateChangeTypes.InputFocus:
          return {
            ...changes,
            isOpen: false, // keep the menu closed when input gets focused.
          }
        case useCombobox.stateChangeTypes.ToggleButtonClick:
          return {
            ...changes,
            isOpen: !state.isOpen,
          }
        default:
          return changes
      }
    },
    ...comboboxProps,
  })

  /** Effect to update filtered items whenever items prop changes. */
  useEffect(() => {
    setFilteredItems(getFilteredItems(inputValue))
  }, [getFilteredItems, inputValue, items])

  const isItemSelected = useCallback(
    (item: ComboboxItem) => {
      return !!selectedItem && itemToValue(selectedItem) === itemToValue(item)
    },
    [selectedItem],
  )

  const resetInputValue = useCallback(() => setInputValue(''), [setInputValue])

  const styles = useMultiStyleConfig('SingleSelect', {
    size,
    isClearable,
    colorScheme,
  })

  const virtualListHeight = useMemo(() => {
    // UPDATE: allow proper rendering of dropdown with both label and description
    let updatedSize = size
    for (const item of filteredItems) {
      if (itemToDescriptionString(item)) {
        updatedSize = 'lg'
        break
      }
    }

    const itemHeight = fixedItemHeight ?? VIRTUAL_LIST_ITEM_HEIGHT[updatedSize]
    // If the total height is less than the max height, just return the total height.
    // Otherwise, return the max height.
    return Math.min(filteredItems.length, 4) * itemHeight
  }, [filteredItems, fixedItemHeight, size])

  return (
    <SelectContext.Provider
      value={{
        size,
        isOpen,
        selectedItem,
        isItemSelected,
        toggleMenu,
        closeMenu,
        getInputProps,
        getItemProps,
        getLabelProps,
        getMenuProps,
        getToggleButtonProps,
        selectItem,
        highlightedIndex,
        items: filteredItems,
        nothingFoundLabel,
        inputValue,
        isSearchable,
        isClearable,
        isInvalid,
        isDisabled,
        isReadOnly,
        isRequired,
        name,
        clearButtonLabel,
        placeholder,
        styles,
        isFocused,
        setIsFocused,
        resetInputValue,
        inputAria,
        inputRef,
        virtualListRef,
        virtualListHeight,
        onRefresh,
        isRefreshLoading,
        freeSolo,
        value,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}
