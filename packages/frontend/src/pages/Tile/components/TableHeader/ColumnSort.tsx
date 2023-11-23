import { startTransition, useCallback } from 'react'
import { ImSortAlphaAsc, ImSortAlphaDesc } from 'react-icons/im'
import { MdCheck } from 'react-icons/md'
import { Flex, Text, VStack } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { Column } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

interface ColumnSortProps {
  column: Column<GenericRowData, unknown>
}

export default function ColumnSort({ column }: ColumnSortProps) {
  const sortDir = column.getIsSorted()

  const setSort = useCallback(
    (dir: 'asc' | 'desc') => {
      startTransition(() => {
        if (sortDir === dir) {
          return column.clearSorting()
        }
        column.toggleSorting(dir === 'desc', true)
      })
    },
    [column, sortDir],
  )

  return (
    <VStack alignItems="stretch">
      <Flex justifyContent="space-between" w="100%">
        <Text textStyle="subhead-2">Filter</Text>
        {sortDir && (
          <Text
            color="primary.500"
            textStyle="subhead-2"
            textDecor="underline"
            cursor="pointer"
            onClick={() => setSort(sortDir)}
          >
            Clear
          </Text>
        )}
      </Flex>
      <Button
        variant="clear"
        leftIcon={<ImSortAlphaAsc />}
        colorScheme={'secondary'}
        rightIcon={sortDir === 'asc' ? <MdCheck /> : undefined}
        justifyContent="flex-start"
        onClick={() => setSort('asc')}
      >
        Ascending
      </Button>
      <Button
        variant="clear"
        leftIcon={<ImSortAlphaDesc />}
        rightIcon={sortDir === 'desc' ? <MdCheck /> : undefined}
        justifyContent="flex-start"
        colorScheme={'secondary'}
        onClick={() => setSort('desc')}
      >
        Descending
      </Button>
    </VStack>
  )
}
