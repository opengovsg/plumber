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
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  Input,
  PopoverCloseButton,
} from '@opengovsg/design-system-react'
import { Header } from '@tanstack/react-table'

import { useUpdateTable } from '../hooks/useUpdateTable'
import { GenericRowData } from '../types'

import ColumnResizer from './ColumnResizer'

interface ColumnHeaderCellProps {
  columnName: string
  header: Header<GenericRowData, unknown>
}

export default function ColumnHeaderCell({
  header,
  columnName,
}: ColumnHeaderCellProps) {
  const { id } = header
  const { isOpen, onClose, onOpen } = useDisclosure()
  const { updateColumns, isUpdatingColumns } = useUpdateTable()
  const [newColumnName, setNewColumnName] = useState(columnName)

  const onSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmedNewColumnName = newColumnName.trim()
      if (!trimmedNewColumnName.length) {
        return
      }
      await updateColumns([{ id, name: trimmedNewColumnName }])
      onClose()
    },
    [newColumnName, updateColumns, id, onClose],
  )

  return (
    <Flex
      h="100%"
      w={header.getSize()}
      borderRightWidth={'0.5px'}
      borderColor="primary.400"
    >
      <Popover
        closeOnBlur={true}
        isOpen={isOpen}
        onClose={onClose}
        onOpen={onOpen}
      >
        <PopoverTrigger>
          <Flex
            w="100%"
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
                isRequired
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
              />
            </PopoverBody>
            <PopoverFooter justifyContent="flex-end" display="flex">
              <Button type="submit" isLoading={isUpdatingColumns}>
                Save
              </Button>
            </PopoverFooter>
          </form>
        </PopoverContent>
      </Popover>
      <ColumnResizer header={header} />
    </Flex>
  )
}
