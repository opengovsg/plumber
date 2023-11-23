import { useCallback, useMemo, useState } from 'react'
import { Flex, Text, VStack } from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'
import { Column } from '@tanstack/react-table'
import { debounce } from 'lodash'

import { GenericRowData } from '../../types'

interface ColumnFilterProps {
  column: Column<GenericRowData, unknown>
}

export function ColumnFilter({ column }: ColumnFilterProps) {
  const [value, setValue] = useState<string>(
    (column.getFilterValue() || '') as string,
  )

  const setFilterDebounced = useMemo(
    () =>
      debounce((value: string) => {
        column.setFilterValue(value)
      }, 500),
    [column],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value)
      setFilterDebounced(e.target.value)
    },
    [setFilterDebounced],
  )

  const onClear = useCallback(() => {
    setValue('')
    column.setFilterValue('')
  }, [column])

  return (
    <VStack p={4} gap={1} alignItems="flex-start">
      <Flex justifyContent="space-between" w="100%">
        <Text textStyle="subhead-2">Filter</Text>
        {!!column.getFilterValue() && (
          <Text
            color="primary.500"
            textStyle="subhead-2"
            textDecor="underline"
            cursor="pointer"
            onClick={onClear}
          >
            Clear
          </Text>
        )}
      </Flex>
      <Input
        onChange={onChange}
        defaultValue={value}
        placeholder="Filter text"
      />
    </VStack>
  )
}
