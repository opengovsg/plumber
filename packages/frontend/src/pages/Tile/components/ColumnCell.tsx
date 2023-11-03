import { FormEvent, useCallback, useState } from 'react'
import {
  Flex,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
} from '@chakra-ui/react'
import {
  Button,
  Input,
  PopoverCloseButton,
} from '@opengovsg/design-system-react'

import { useUpdateTable } from '../hooks/useUpdateTable'

interface ColumnCellProps {
  columnId: string
  columnName: string
}

export default function ColumnCell({ columnId, columnName }: ColumnCellProps) {
  const { updateColumn, isUpdatingColumn } = useUpdateTable()
  const [newColumnName, setNewColumnName] = useState(columnName)

  const onSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!newColumnName.length) {
        return
      }
      await updateColumn(columnId, newColumnName)
    },
    [newColumnName, updateColumn, columnId],
  )

  return (
    <Flex h="100%">
      <Popover closeOnBlur={true}>
        <PopoverTrigger>
          <Flex
            tabIndex={0}
            py={2}
            px={4}
            cursor="pointer"
            alignItems="center"
            justifyContent="space-between"
            _hover={{
              bg: 'primary.800',
            }}
            _focus={{
              outline: 'none',
            }}
          >
            {columnName}
          </Flex>
        </PopoverTrigger>
        <PopoverContent color="secondary.900" outline="none">
          <PopoverArrow />
          <PopoverCloseButton top={0} right={1} />
          <PopoverHeader>Edit column</PopoverHeader>
          <form onSubmit={onSave}>
            <PopoverBody>
              <Input
                placeholder="Column name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
              />
            </PopoverBody>
            <PopoverFooter justifyContent="flex-end" display="flex">
              <Button type="submit" isLoading={isUpdatingColumn}>
                Save
              </Button>
            </PopoverFooter>
          </form>
        </PopoverContent>
      </Popover>
    </Flex>
  )
}
