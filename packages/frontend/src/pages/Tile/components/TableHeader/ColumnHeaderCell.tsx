import { MdDragIndicator } from 'react-icons/md'
import {
  Flex,
  Icon,
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  useDisclosure,
} from '@chakra-ui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Header } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

import ColumnResizer from './ColumnResizer'
import DeleteColumnButton from './DeleteColumnButton'
import EditColumnName from './EditColumnName'

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
      w={header.getSize()}
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
          </Flex>
        </PopoverTrigger>
        <PopoverContent color="secondary.900" outline="none">
          <PopoverArrow />
          <PopoverHeader>
            <EditColumnName id={id} columnName={columnName} />
          </PopoverHeader>
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
