import { memo } from 'react'
import { FaCaretDown, FaFilter } from 'react-icons/fa'
import { ImSortAlphaAsc, ImSortAlphaDesc } from 'react-icons/im'
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
      maxH="100%"
      overflow="visible"
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
            py={2}
            pl={4}
            pr={1}
            overflow="hidden"
            cursor={isDragging ? 'grabbing' : 'pointer'}
            alignItems="center"
            gap={1}
            justifyContent="space-between"
            _hover={{
              bg: 'primary.800',
            }}
            _focus={{
              outline: 'none',
            }}
            {...attributes}
            {...listeners}
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
              {!isFiltered && !sortDir && (
                <Icon
                  as={FaCaretDown}
                  transform={isOpen ? 'rotate(180deg)' : undefined}
                  w={4}
                  h={4}
                />
              )}
            </Flex>
          </Flex>
        </PopoverTrigger>

        <PopoverContent
          color="secondary.900"
          outline="none"
          _focusVisible={{
            boxShadow: 'none',
          }}
          motionProps={{
            variants: {
              exit: {
                opacity: 0,
                transition: {
                  duration: 0,
                },
              },
              enter: {
                opacity: 1,
                transition: {
                  duration: 0,
                },
              },
            },
          }}
        >
          <PopoverArrow />
          <PopoverHeader px={4}>
            <EditColumnName id={id} columnName={columnName} />
          </PopoverHeader>
          <PopoverBody px={4}>
            <ColumnSort column={column} />
            <ColumnFilter column={column} />
          </PopoverBody>
          <PopoverFooter justifyContent="flex-start" display="flex" px={4}>
            <DeleteColumnButton id={id} />
          </PopoverFooter>
        </PopoverContent>
      </Popover>
      <ColumnResizer header={header} />
    </Flex>
  )
}

export default memo(ColumnHeaderCell)
