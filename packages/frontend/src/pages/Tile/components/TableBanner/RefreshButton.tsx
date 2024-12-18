import { Flex } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'

import { useTableContext } from '../../contexts/TableContext'

export default function RefreshButton() {
  const { isFetching } = useTableContext()

  if (isFetching) {
    return (
      <Flex
        alignItems="center"
        w="100%"
        gap={2}
        color="primary.500"
        fontSize="sm"
      >
        <Spinner /> Fetching more rows...
      </Flex>
    )
  }

  // Will add refresh button in future
  return null
}
