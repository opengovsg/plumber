// Hook to normalize item array for easy filtering and checking of state

import { useCallback, useMemo } from 'react'

import { ComboboxItem } from '../types'
import { itemToValue } from '../utils/itemUtils'

type ItemWithIndex<Item extends ComboboxItem = ComboboxItem> = {
  item: Item
  index: number
}

type UseItemsReturn<Item extends ComboboxItem = ComboboxItem> = {
  byValue: Record<string, ItemWithIndex<Item>>
}

export const useLookupItems = <Item extends ComboboxItem = ComboboxItem>({
  rawItems,
}: {
  rawItems: Item[]
}) => {
  const normalizedItems = useMemo(() => {
    const initialStore: UseItemsReturn<Item> = {
      // Normalized store for filtering and retrieval of state
      byValue: {},
    }

    let itemIndex = 0

    return rawItems.reduce((store, item) => {
      const value = itemToValue(item)
      // Do nothing if no value.
      if (!value) {
        return store
      }

      store.byValue[value] = {
        item,
        index: itemIndex,
      }

      // Only increment if item has a value.
      itemIndex++
      return store
    }, initialStore)
  }, [rawItems])

  const getItemByValue = useCallback(
    (value: string): ItemWithIndex<Item> | null => {
      return normalizedItems.byValue[value] ?? null
    },
    [normalizedItems.byValue],
  )

  return {
    getItemByValue,
  }
}
