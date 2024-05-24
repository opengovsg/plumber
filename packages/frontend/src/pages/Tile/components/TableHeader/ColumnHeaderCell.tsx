import { memo, useState } from 'react'
import { BiTrash } from 'react-icons/bi'
import { GoChevronDown, GoFilter } from 'react-icons/go'
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
import { Button } from '@opengovsg/design-system-react'
import { Header } from '@tanstack/react-table'

import {
  BORDER_COLOR,
  HEADER_COLOR,
  POPOVER_MOTION_PROPS,
} from '../../constants'
import { useTableContext } from '../../contexts/TableContext'
import { GenericRowData } from '../../types'

import { ColumnFilter } from './ColumnFilter'
import ColumnResizer from './ColumnResizer'
import ColumnSort from './ColumnSort'
import DeletionModal from './DeleteColumnModal'
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
  const { mode, tableColumns } = useTableContext()
  const { id } = header
  const { isOpen, onClose, onOpen } = useDisclosure()
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
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

  const isEditMode = mode === 'edit'

  return (
    <Flex
      h="100%"
      maxH="100%"
      overflow="visible"
      style={{ ...style }}
      scaleX={1}
      w={columnWidth}
      borderRightWidth={'0.5px'}
      borderColor={BORDER_COLOR.DEFAULT}
      ref={setNodeRef}
      zIndex={isDragging ? 2 : undefined}
    >
      <Popover
        closeOnBlur={true}
        isOpen={isOpen}
        onClose={onClose}
        onOpen={onOpen}
        isLazy
        lazyBehavior="unmount"
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
              bg: HEADER_COLOR.HOVER,
            }}
            _focus={{
              outline: 'none',
            }}
            {...attributes}
            {...(isEditMode ? listeners : {})}
          >
            <Text
              overflow="hidden"
              whiteSpace="nowrap"
              textOverflow="ellipsis"
              maxW="100%"
              textStyle="subhead-2"
              userSelect="none"
            >
              {columnName}
            </Text>
            <Flex gap={2}>
              {isFiltered && (
                <Icon
                  as={GoFilter}
                  w={6}
                  h={6}
                  p={1}
                  bg="primary.200"
                  borderRadius="lg"
                />
              )}
              {sortDir && (
                <Icon
                  as={sortDir === 'desc' ? ImSortAlphaDesc : ImSortAlphaAsc}
                  w={6}
                  h={6}
                  p={1}
                  bg="primary.200"
                  borderRadius="lg"
                />
              )}
              {!isFiltered && !sortDir && (
                <Icon
                  as={GoChevronDown}
                  transform={isOpen ? 'rotate(180deg)' : undefined}
                  w={4}
                  h={4}
                />
              )}
            </Flex>
          </Flex>
        </PopoverTrigger>

        <PopoverContent
          outline="none"
          _focusVisible={{
            boxShadow: 'none',
          }}
          motionProps={POPOVER_MOTION_PROPS}
        >
          <PopoverArrow />
          {isEditMode && (
            <PopoverHeader px={4}>
              <EditColumnName id={id} columnName={columnName} />
            </PopoverHeader>
          )}
          <PopoverBody px={4}>
            <ColumnSort column={column} />
            <ColumnFilter column={column} />
          </PopoverBody>
          {/* Disallow deletion of last column */}
          {isEditMode && tableColumns.length > 1 && (
            <PopoverFooter justifyContent="flex-start" display={'flex'} px={4}>
              <Button
                leftIcon={<Icon as={BiTrash} boxSize={4} />}
                variant="link"
                py={2}
                color="utility.feedback.critical"
                _hover={{
                  color: 'red.400',
                }}
                onClick={() => setIsDeletionModalOpen(true)}
              >
                Delete column
              </Button>
            </PopoverFooter>
          )}
        </PopoverContent>
      </Popover>
      <ColumnResizer header={header} />
      {isDeletionModalOpen && (
        <DeletionModal
          columnId={column.id}
          columnName={columnName}
          onClose={() => setIsDeletionModalOpen(false)}
        />
      )}
    </Flex>
  )
}

export default memo(ColumnHeaderCell)
