import { BiErrorCircle } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'

import { useTableContext } from '../../contexts/TableContext'

export default function RefreshButton() {
  const {
    isFetching,
    isThroughputError,
    refetch: retryFetching,
  } = useTableContext()

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

  if (isThroughputError) {
    return (
      <Flex
        alignItems="center"
        justifyContent="center"
        w="max-content"
        gap={2}
        fontSize="sm"
        color="red.500"
      >
        <Icon boxSize={5} as={BiErrorCircle} />

        <Text>Error loading rows.</Text>
        <Text
          cursor="pointer"
          onClick={retryFetching}
          decoration="underline"
          _hover={{ color: 'primary.600' }}
        >
          Retry
        </Text>
      </Flex>
    )
  }

  // Will add refresh button in future
  return null
}
