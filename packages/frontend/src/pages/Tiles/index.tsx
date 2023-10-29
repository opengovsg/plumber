import { Flex } from '@chakra-ui/react'
import Container from 'components/Container'
import PageTitle from 'components/PageTitle'

import CreateTileButton from './components/CreateTileButton'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

export default function Tiles(): JSX.Element {
  return (
    <Container py={7}>
      <Flex
        flexDir={{ base: 'column' }}
        justifyContent="space-between"
        alignItems="stretch"
        gap={8}
      >
        <Flex
          pl={{ base: 0, sm: 8 }}
          alignItems="center"
          justifyContent="space-between"
        >
          <PageTitle title={TILES_TITLE} />
          <CreateTileButton />
        </Flex>
        <TileList />
      </Flex>
    </Container>
  )
}
