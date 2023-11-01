import { useCallback } from 'react'
import { BsPlus } from 'react-icons/bs'
import { Flex, Kbd } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { Table } from '@tanstack/react-table'

import { scrollToBottom, scrollToTop } from '../helpers/scroll-helper'
import { GenericRowData } from '../types'

interface TableFooterProps {
  table: Table<GenericRowData>
  parentRef: React.RefObject<HTMLDivElement>
}

export default function TableFooter({ table, parentRef }: TableFooterProps) {
  const onAddNewRow = useCallback(() => {
    table.options.meta?.addNewRow()
    table.options.meta?.focusOnNewRow()
  }, [table])

  return (
    <Flex
      w="100%"
      position="sticky"
      left={0}
      justifyContent="space-between"
      borderColor="primary.800"
      borderTopWidth={1}
    >
      <Flex>
        <Button
          variant="clear"
          size="sm"
          onClick={() => scrollToTop(parentRef)}
        >
          Scroll to Top <Kbd bg="white">home</Kbd>
        </Button>
        <Button
          variant="clear"
          size="sm"
          onClick={() => scrollToBottom(parentRef)}
        >
          Scroll to bottom <Kbd bg="white">end</Kbd>
        </Button>
      </Flex>
      <Button
        variant="clear"
        size="sm"
        leftIcon={<BsPlus />}
        onClick={onAddNewRow}
      >
        Add New Row
      </Button>
    </Flex>
  )
}
