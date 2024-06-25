import { FormEvent, useCallback, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import {
  Flex,
  Icon,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  Input,
  PopoverCloseButton,
} from '@opengovsg/design-system-react'
import { HeaderContext } from '@tanstack/react-table'
import { GenericRowData } from 'pages/Tile/types'
import { POPOVER_MOTION_PROPS } from 'theme/constants'

import { HEADER_COLOR } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'
import { useUpdateTable } from '../../hooks/useUpdateTable'

export default function NewColumnHeaderCell({
  column,
}: HeaderContext<GenericRowData, unknown>) {
  const { mode } = useTableContext()
  const isViewMode = mode === 'view'

  const { isOpen, onClose, onOpen } = useDisclosure()
  const { createColumns, isCreatingColumns } = useUpdateTable()
  const [newColumnName, setNewColumnName] = useState('')

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!newColumnName.length) {
        return
      }
      await createColumns([newColumnName])
      setNewColumnName('')
      onClose()
    },
    [createColumns, newColumnName, onClose],
  )

  if (isViewMode) {
    return null
  }

  return (
    <Popover
      closeOnBlur={true}
      computePositionOnMount
      onClose={onClose}
      onOpen={onOpen}
      isOpen={isOpen}
      isLazy={true}
      lazyBehavior="unmount"
    >
      <PopoverTrigger>
        <Flex
          h="100%"
          position="relative"
          w={column.getSize() + 'px'}
          _hover={{
            bg: HEADER_COLOR.HOVER,
          }}
          _focus={{
            outline: 'none',
          }}
          cursor="pointer"
          tabIndex={0}
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={FiPlus} h={5} w={5} />
        </Flex>
      </PopoverTrigger>
      <PopoverContent color="secondary.900" motionProps={POPOVER_MOTION_PROPS}>
        <PopoverArrow />
        <PopoverCloseButton top={1} right={1} />
        <PopoverHeader py={4} px={4}>
          <Text textStyle="subhead-2">Add new column</Text>
        </PopoverHeader>
        <form onSubmit={onSubmit}>
          <PopoverBody px={4}>
            <Input
              placeholder="Column name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
            />
          </PopoverBody>
          <PopoverFooter justifyContent="flex-end" display="flex" px={4}>
            <Button type="submit" isLoading={isCreatingColumns} size="sm">
              Add
            </Button>
          </PopoverFooter>
        </form>
      </PopoverContent>
    </Popover>
  )
}
