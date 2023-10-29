import { useParams } from 'react-router-dom'
import { Flex, Text } from '@chakra-ui/react'
import Container from 'components/Container'

export default function Tile(): JSX.Element {
  const { tableId } = useParams<{ tableId: string }>()

  return (
    <Container py={7}>
      <Flex
        flexDir={{ base: 'column' }}
        justifyContent="space-between"
        alignItems="stretch"
        gap={4}
      >
        <Text textStyle="h4">table id: {tableId}</Text>
      </Flex>
    </Container>
  )
}
