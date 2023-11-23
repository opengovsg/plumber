import {
  FormEvent,
  startTransition,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { MdArrowDownward, MdArrowUpward, MdOutlineClear } from 'react-icons/md'
import { Input, InputGroup, InputRightElement } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import { Table, TableMeta } from '@tanstack/react-table'
import { Virtualizer } from '@tanstack/react-virtual'

import { ROW_HEIGHT } from '../../constants'
import { CellType, GenericRowData } from '../../types'

interface SearchBarProps {
  table: Table<GenericRowData>
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
}

export default function SearchBar({ table, rowVirtualizer }: SearchBarProps) {
  const { rows } = table.getSortedRowModel()
  const tableMeta = table.options.meta as TableMeta<GenericRowData>
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [tempSearchString, setTempSearchString] = useState('')
  const [searchPosition, setSearchPosition] = useState<[number, number] | null>(
    null,
  )

  const onInputChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      setTempSearchString(e.currentTarget.value)
      setSearchPosition(null)
      if (!e.currentTarget.value) {
        tableMeta.setHighlightedCell(null)
        tableMeta.setSearchString('')
      }
    },
    [tableMeta],
  )

  const doesCellContainSearchString = useCallback(
    (cell: CellType, tempSearchString: string) => {
      const value = cell.getValue()
      return (
        typeof value === 'string' &&
        value.toLowerCase().includes(tempSearchString)
      )
    },
    [],
  )

  const searchBarShortcut = useCallback((e: KeyboardEvent) => {
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setShowSearchBar(true)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowSearchBar(false)
    }
  }, [])

  // Override global search bar
  useEffect(() => {
    document.addEventListener('keydown', searchBarShortcut)
    return () => {
      document.removeEventListener('keydown', searchBarShortcut)
    }
  }, [searchBarShortcut])

  const search = useCallback(async () => {
    startTransition(() => {
      const lowercasedSearchString = tempSearchString.toLowerCase()
      tableMeta.setSearchString(lowercasedSearchString)

      if (!lowercasedSearchString) {
        return
      }
      let firstCellVisited = null
      let hasLooped = false
      const initialI = searchPosition ? searchPosition[0] : 0
      for (
        let i = initialI;
        i < rows.length;
        i === rows.length - 1 ? (i = 0) : i++
      ) {
        const row = rows[i]
        const cells = row.getVisibleCells().slice(1, -1)
        const initialJ =
          searchPosition && i === searchPosition[0] && !hasLooped
            ? searchPosition[1] + 1
            : 0
        hasLooped = true
        for (let j = initialJ; j < cells.length; j++) {
          if (firstCellVisited == null) {
            firstCellVisited = [i, j]
          } else {
            if (i === firstCellVisited[0] && j === firstCellVisited[1]) {
              return
            }
          }
          const cell = cells[j] as CellType
          if (doesCellContainSearchString(cell, lowercasedSearchString)) {
            setSearchPosition([i, j])
            table.options.meta?.setHighlightedCell(cell as CellType)
            rowVirtualizer.scrollToIndex(i)
            return
          }
        }
      }
    })
  }, [
    doesCellContainSearchString,
    rowVirtualizer,
    rows,
    searchPosition,
    table.options.meta,
    tableMeta,
    tempSearchString,
  ])

  const searchReverse = useCallback(async () => {
    startTransition(() => {
      const lowercasedSearchString = tempSearchString.toLowerCase()
      tableMeta.setSearchString(lowercasedSearchString)
      if (!lowercasedSearchString || rows.length === 0) {
        return
      }
      let firstCellVisited = null
      let hasLooped = false
      const initialI = searchPosition ? searchPosition[0] : rows.length - 1
      for (let i = initialI; i >= 0; i === 0 ? (i = rows.length - 1) : i--) {
        const row = rows[i]
        const cells = row.getVisibleCells().slice(1, -1)
        const initialJ =
          searchPosition && i === searchPosition[0] && !hasLooped
            ? searchPosition[1] - 1
            : cells.length - 1
        hasLooped = true
        for (let j = initialJ; j >= 0; j--) {
          if (firstCellVisited == null) {
            firstCellVisited = [i, j]
          } else {
            if (i === firstCellVisited[0] && j === firstCellVisited[1]) {
              return
            }
          }
          const cell = cells[j] as CellType
          if (doesCellContainSearchString(cell, lowercasedSearchString)) {
            setSearchPosition([i, j])
            table.options.meta?.setHighlightedCell(cell as CellType)
            rowVirtualizer.scrollToIndex(i)
            return
          }
        }
      }
    })
  }, [
    doesCellContainSearchString,
    rowVirtualizer,
    rows,
    searchPosition,
    table.options.meta,
    tableMeta,
    tempSearchString,
  ])

  const onKeyDown = useCallback(
    // not importing from React to prevent disambiguation with default KeyboardEvent
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.shiftKey ? searchReverse() : search()
      }
    },
    [search, searchReverse],
  )

  if (!showSearchBar) {
    return null
  }

  return (
    <InputGroup
      position="absolute"
      top={`${ROW_HEIGHT.HEADER}px`}
      right={6}
      mt={2}
      width="400px"
      bg="white"
      size="md"
      display="flex"
      alignItems="center"
    >
      <Input
        value={tempSearchString}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        autoFocus
        pr={24}
      />
      <InputRightElement
        width="auto"
        my={1.5}
        px={2}
        height={8}
        borderRadius="sm"
        overflow="hidden"
      >
        <IconButton
          size="xs"
          p={1.5}
          variant="clear"
          colorScheme="secondary"
          isDisabled={!tempSearchString}
          icon={<MdArrowUpward />}
          aria-label="reverse-search"
          onClick={searchReverse}
        />
        <IconButton
          size="xs"
          p={1.5}
          variant="clear"
          colorScheme="secondary"
          isDisabled={!tempSearchString}
          icon={<MdArrowDownward />}
          aria-label="search"
          onClick={search}
        />
        <IconButton
          size="xs"
          p={1.5}
          variant="clear"
          colorScheme="secondary"
          icon={<MdOutlineClear />}
          aria-label="close-search"
          onClick={() => setShowSearchBar(false)}
        />
      </InputRightElement>
    </InputGroup>
  )
}
