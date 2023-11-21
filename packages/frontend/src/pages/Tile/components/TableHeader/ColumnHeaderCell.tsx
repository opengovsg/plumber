import { memo, useCallback } from 'react'
import { BiCaretDown } from 'react-icons/bi'
import { ImSortAlphaAsc, ImSortAlphaDesc } from 'react-icons/im'
import { MdCheck, MdDragIndicator } from 'react-icons/md'
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
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@opengovsg/design-system-react'
import { Header } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

import ColumnResizer from './ColumnResizer'
import DeleteColumnButton from './DeleteColumnButton'
import EditColumnName from './EditColumnName'

interface ColumnHeaderCellProps {
  columnName: string
  columnWidth: number
  header: Header<GenericRowData, unknown>
}

function ColumnHeaderCell({
  header,
  columnName,
  columnWidth,
}: ColumnHeaderCellProps) {
  const { id } = header
  const { isOpen, onClose, onOpen } = useDisclosure()
  const column = header.getContext().column

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const sortDir = column.getIsSorted()

  const setSort = useCallback(
    (dir: 'asc' | 'desc') => {
      if (sortDir === dir) {
        return column.clearSorting()
      }
      column.toggleSorting(dir === 'desc', true)
    },
    [column, sortDir],
  )

  return (
    <Flex
      h="100%"
      style={{ ...style }}
      scaleX={1}
      w={columnWidth}
      borderRightWidth={'0.5px'}
      borderColor="primary.400"
      ref={setNodeRef}
      bg="primary.700"
      zIndex={isDragging ? 2 : undefined}
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
            overflow="hidden"
            whiteSpace="nowrap"
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
            {sortDir && (
              <Icon
                as={BiCaretDown}
                transform={sortDir === 'desc' ? 'rotate(180deg)' : undefined}
                w={5}
                h={5}
              />
            )}
          </Flex>
        </PopoverTrigger>
        <PopoverContent color="secondary.900" outline="none">
          <PopoverArrow />
          <PopoverHeader>
            <EditColumnName id={id} columnName={columnName} />
          </PopoverHeader>
          <PopoverBody>
            <VStack alignItems="stretch">
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
          </PopoverBody>
          <PopoverFooter justifyContent="flex-start" display="flex">
            <DeleteColumnButton id={id} />
          </PopoverFooter>
        </PopoverContent>
      </Popover>
      <Icon
        as={MdDragIndicator}
        w={5}
        h="100%"
        opacity={0.5}
        cursor="grab"
        _hover={{
          opacity: 1,
          bg: 'primary.800',
        }}
        _focus={{
          outline: 'none',
        }}
        _active={{
          cursor: 'grabbing',
        }}
        {...attributes}
        {...listeners}
      />
      <ColumnResizer header={header} />
    </Flex>
  )
}

export default memo(ColumnHeaderCell)
