import { memo } from 'react'
import { FaFilter } from 'react-icons/fa'
import { ImSortAlphaAsc, ImSortAlphaDesc } from 'react-icons/im'
import { MdDragIndicator } from 'react-icons/md'
import {
  Divider,
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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Header } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

import { ColumnFilter } from './ColumnFilter'
import ColumnResizer from './ColumnResizer'
import ColumnSort from './ColumnSort'
import DeleteColumnButton from './DeleteColumnButton'
import EditColumnName from './EditColumnName'

interface ColumnHeaderCellProps {
  columnName: string
  columnWidth: number
  header: Header<GenericRowData, unknown>
  sortDir: 'asc' | 'desc' | false
  isFiltered: boolean
}

function ColumnHeaderCell({
  header,
  columnName,
  columnWidth,
  sortDir,
  isFiltered,
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
        isLazy={true}
        lazyBehavior="unmount"
      >
        <PopoverTrigger>
          <Flex
            w="100%"
            tabIndex={0}
            py={2}
            pl={4}
            pr={1}
            overflow="hidden"
            cursor="pointer"
            alignItems="center"
            gap={1}
            justifyContent="space-between"
            _hover={{
              bg: 'primary.800',
            }}
            _focus={{
              outline: 'none',
            }}
          >
            <Text
              overflow="hidden"
              whiteSpace="nowrap"
              textOverflow="ellipsis"
              maxW="100%"
            >
              {columnName}
            </Text>
            <Flex gap={2}>
              {isFiltered && <Icon as={FaFilter} w={4} h={4} />}
              {sortDir && (
                <Icon
                  as={sortDir === 'desc' ? ImSortAlphaDesc : ImSortAlphaAsc}
                  w={4}
                  h={4}
                />
              )}
            </Flex>
          </Flex>
        </PopoverTrigger>

        <PopoverContent color="secondary.900" outline="none">
          <PopoverArrow />
          <PopoverHeader>
            <EditColumnName id={id} columnName={columnName} />
          </PopoverHeader>
          <PopoverBody>
            <ColumnSort column={column} />
            <Divider />
            <ColumnFilter column={column} />
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
