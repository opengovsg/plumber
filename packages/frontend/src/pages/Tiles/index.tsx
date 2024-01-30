import { ITableMetadata } from '@plumber/types'

import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Spinner } from '@chakra-ui/react'
import Container from 'components/Container'
import PageTitle from 'components/PageTitle'
import { TILES_FEATURE_FLAG } from 'config/flags'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { GET_TABLES } from 'graphql/queries/get-tables'

import CreateTileButton from './components/CreateTileButton'
import EmptyTileList from './components/EmptyTileList'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

export default function Tiles(): JSX.Element {
  /**
   * Check if feature flag is enabled, otherwise redirect to 404
   */
  const { flags, isLoading: isFlagsLoading } = useContext(LaunchDarklyContext)
  const navigate = useNavigate()

  // for feature flag gating, to remove in future
  if (!isFlagsLoading && !flags?.[TILES_FEATURE_FLAG]) {
    navigate('/404')
  }

  const { data, loading: isTileListLoading } = useQuery<{
    getTables: ITableMetadata[]
  }>(GET_TABLES)

  if (!data?.getTables || isTileListLoading) {
    return (
      <Center h="100%">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const isEmpty = data.getTables.length === 0
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
          {!isEmpty && <CreateTileButton />}
        </Flex>
        {isEmpty ? <EmptyTileList /> : <TileList tiles={data.getTables} />}
      </Flex>
    </Container>
  )
}
