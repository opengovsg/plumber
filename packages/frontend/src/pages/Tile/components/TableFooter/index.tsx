import { memo } from 'react'
import { Flex, Kbd } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { ROW_HEIGHT, Z_INDEX } from '../../constants'
import { scrollToBottom, scrollToTop } from '../../helpers/scroll-helper'

import DeleteRowsButton from './DeleteRowsButton'
import RowCount from './RowCount'

interface TableFooterProps {
  removeRows: (rows: string[]) => void
  rowCount: number
  rowSelection: Record<string, boolean>
  parentRef: React.RefObject<HTMLDivElement>
}

function TableFooter({
  removeRows,
  rowCount,
  rowSelection,
  parentRef,
}: TableFooterProps) {
  return (
    <Flex
      w="100%"
      bg="white"
      position="sticky"
      bottom={0}
      left={0}
      right={0}
      zIndex={Z_INDEX.FOOTER}
      minH={`${ROW_HEIGHT.FOOTER}px`}
      maxH={`${ROW_HEIGHT.FOOTER}px`}
      justifyContent="space-between"
      boxSizing="content-box"
      borderTopWidth={1}
    >
      <Flex>
        <RowCount rowCount={rowCount} rowSelection={rowSelection} />
        <DeleteRowsButton rowSelection={rowSelection} removeRows={removeRows} />
      </Flex>
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
    </Flex>
  )
}

export default memo(TableFooter)
