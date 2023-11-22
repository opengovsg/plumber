import { Flex, Kbd } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { Table } from '@tanstack/react-table'

import { ROW_HEIGHT, Z_INDEX } from '../../constants'
import { scrollToBottom, scrollToTop } from '../../helpers/scroll-helper'
import { GenericRowData } from '../../types'

import DeleteRowsButton from './DeleteRowsButton'

interface TableFooterProps {
  table: Table<GenericRowData>
  parentRef: React.RefObject<HTMLDivElement>
}

export default function TableFooter({ table, parentRef }: TableFooterProps) {
  return (
    <Flex
      w="100%"
      bg="white"
      position="sticky"
      bottom={0}
      left={0}
      zIndex={Z_INDEX.FOOTER}
      maxH={ROW_HEIGHT.FOOTER - 1} // -1 to prevent border from overflowing
      justifyContent="space-between"
      borderColor="primary.800"
      boxSizing="content-box"
      borderTopWidth={1}
    >
      <Flex>
        <Button
          variant="clear"
          size="xs"
          h="100%"
          onClick={() => scrollToTop(parentRef)}
        >
          Scroll to Top <Kbd bg="white">home</Kbd>
        </Button>
        <Button
          variant="clear"
          size="xs"
          h="100%"
          onClick={() => scrollToBottom(parentRef)}
        >
          Scroll to bottom <Kbd bg="white">end</Kbd>
        </Button>
      </Flex>
      <Flex>{<DeleteRowsButton table={table} />}</Flex>
    </Flex>
  )
}