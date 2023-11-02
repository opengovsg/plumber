import { FormEvent, useCallback, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import {
  Box,
  Icon,
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

export default function AddNewColumn() {
  const { createColumn, isCreatingColumn } = useUpdateTable()
  const [newColumnName, setNewColumnName] = useState('')

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!newColumnName.length) {
        return
      }
      await createColumn(newColumnName)
    },
    [createColumn, newColumnName],
  )

  return (
    <Popover closeOnBlur={true} computePositionOnMount>
      <PopoverTrigger>
        <Box h="100%">
          <Icon
            tabIndex={0}
            as={FiPlus}
            px={4}
            display="block"
            h="100%"
            w="100%"
            _hover={{
              bg: 'primary.800',
            }}
            _focus={{
              outline: 'none',
            }}
            cursor="pointer"
          />
        </Box>
      </PopoverTrigger>
      <PopoverContent color="secondary.900">
        <PopoverArrow />
        <PopoverCloseButton top={0} right={1} />
        <PopoverHeader>Add new column</PopoverHeader>
        <form onSubmit={onSubmit}>
          <PopoverBody>
            <Input
              placeholder="Column name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
            />
          </PopoverBody>
          <PopoverFooter justifyContent="flex-end" display="flex">
            <Button type="submit" isLoading={isCreatingColumn}>
              Add
            </Button>
          </PopoverFooter>
        </form>
      </PopoverContent>
    </Popover>
  )
}
