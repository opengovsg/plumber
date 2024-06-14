import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import {
  FormControlOptions,
  ThemingProps,
  useFormControlProps,
  useMultiStyleConfig,
  useTheme,
} from '@chakra-ui/react'
import {
  useCombobox,
  UseComboboxProps,
  type UseComboboxState,
  type UseComboboxStateChangeOptions,
} from 'downshift'

import { useLookupItems } from './hooks/useLookupItems'
import { defaultFilter } from './utils/defaultFilter'
import {
  isItemDisabled,
  itemToDescriptionString,
  itemToValue,
} from './utils/itemUtils'
import { VIRTUAL_LIST_ITEM_HEIGHT } from './constants'
import { SelectContext, SharedSelectContextReturnProps } from './SelectContext'
import type { ComboboxItem } from './types'

function getFreeSoloItem(freeSoloValue: string) {
  return {
    value: freeSoloValue,
    label: freeSoloValue,
    description: 'Use this custom value',
  }
}

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
}

export const SingleSelectProvider = ({
  items: allItems,
  value,
  onChange,
  name,
  filter = defaultFilter,
  nothingFoundLabel = 'No matching results',
  placeholder = 'Select an option',
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
  onRefresh = null,
  isRefreshLoading = false,
  freeSolo = false,
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

  const { getItemByValue } = useLookupItems({ rawItems: allItems })

  const [isFocused, setIsFocused] = useState(false)

  const { isInvalid, isDisabled, isReadOnly, isRequired } = useFormControlProps(
    {
      isInvalid: isInvalidProp,
      isDisabled: isDisabledProp,
      isReadOnly: isReadOnlyProp,
      isRequired: isRequiredProp,
    },
  )

  const getFilteredItems = useCallback(
    (filterValue?: string) => {
      const filtered =
        filterValue != null ? filter(allItems, filterValue) : allItems
      return [...filtered]
    },
    [filter, allItems],
  )
  const [filteredItems, setFilteredItems] = useState(allItems)

  const memoizedSelectedItem = useMemo(() => {
    const fromItems = getItemByValue(value)
    if (fromItems) {
      return fromItems.item
    }

    const selectedItem = freeSolo && value ? getFreeSoloItem(value) : null
    return selectedItem
  }, [getItemByValue, freeSolo, value])

  useEffect(() => {
    setFilteredItems(allItems)
  }, [allItems])

  const virtualListRef = useRef<VirtuosoHandle>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFreeSoloItem = useCallback(
    (filteredItems: ComboboxItem<string>[], inputValue?: string) => {
      // freeSolo inputValue cannot be null or undefined or blank
      if (inputValue?.trim() && !getItemByValue(inputValue)) {
        return filteredItems.push(getFreeSoloItem(inputValue))
      }
    },
    [getItemByValue],
  )

  const handleInputChange = useCallback(
    (inputValue: string | undefined) => {
      const filteredItems = getFilteredItems(inputValue)
      if (freeSolo) {
        addFreeSoloItem(filteredItems, inputValue)
      }
      setFilteredItems(filteredItems)
    },
    [addFreeSoloItem, freeSolo, getFilteredItems],
  )

  const stateReducer = useCallback(
    (
      state: UseComboboxState<ComboboxItem>,
      { changes, type }: UseComboboxStateChangeOptions<ComboboxItem>,
    ) => {
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
        case useCombobox.stateChangeTypes.FunctionSelectItem:
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.InputBlur:
        case useCombobox.stateChangeTypes.ItemClick: {
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
        default:
          return changes
      }
    },
    [isClearable],
  )

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
    onIsOpenChange: ({ isOpen }) => {
      if (!isOpen) {
        reset()
      }
    },
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
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) {
        onChange('')
      } else if (!isItemDisabled(selectedItem)) {
        onChange(itemToValue(selectedItem))
      }
    },
    onStateChange: ({ inputValue, type }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.FunctionSetInputValue:
        case useCombobox.stateChangeTypes.InputChange:
          handleInputChange(inputValue)
          break
        default:
          return
      }
    },
    stateReducer,
    ...comboboxProps,
  })

  const isItemSelected = useCallback(
    (item: ComboboxItem) => {
      return !!selectedItem && itemToValue(selectedItem) === itemToValue(item)
    },
    [selectedItem],
  )

  const reset = useCallback(() => {
    setFilteredItems(allItems)
    setInputValue('')
  }, [allItems, setInputValue])

  const styles = useMultiStyleConfig('SingleSelect', {
    size,
    isClearable,
    colorScheme,
  })

  const virtualListHeight = useMemo(() => {
    // Size needs to be larger if we have items with descriptions
    const itemsHaveDescription = filteredItems.some((item) =>
      itemToDescriptionString(item),
    )
    const itemHeight =
      fixedItemHeight ??
      VIRTUAL_LIST_ITEM_HEIGHT[itemsHaveDescription ? 'lg' : size]

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
        resetInputValue: reset,
        inputAria,
        inputRef,
        virtualListRef,
        virtualListHeight,
        onRefresh,
        isRefreshLoading,
        freeSolo,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}