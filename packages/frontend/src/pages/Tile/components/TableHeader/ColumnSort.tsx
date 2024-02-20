import { startTransition, useCallback } from 'react'
import { ImSortAlphaAsc, ImSortAlphaDesc } from 'react-icons/im'
import { Box, ButtonGroup, Flex, Text } from '@chakra-ui/react'
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
    <Box py={2}>
      <Flex
        justifyContent="space-between"
        w="100%"
        mb={3}
        textStyle="subhead-2"
        fontWeight={500}
      >
        <Text>Sort</Text>
        {sortDir && (
          <Text
            color="primary.500"
            textDecor="underline"
            cursor="pointer"
            onClick={() => setSort(sortDir)}
          >
            Clear
          </Text>
        )}
      </Flex>
      <ButtonGroup isAttached variant="outline" w="100%">
        <Button
          colorScheme={sortDir === 'asc' ? 'primary' : 'secondary'}
          leftIcon={<ImSortAlphaAsc />}
          justifyContent="center"
          flex={1}
          fontSize="sm"
          onClick={() => setSort('asc')}
        >
          Ascending
        </Button>
        <Button
          colorScheme={sortDir === 'desc' ? 'primary' : 'secondary'}
          leftIcon={<ImSortAlphaDesc />}
          justifyContent="center"
          flex={1}
          fontSize="sm"
          onClick={() => setSort('desc')}
        >
          Descending
        </Button>
      </ButtonGroup>
    </Box>
  )
}
