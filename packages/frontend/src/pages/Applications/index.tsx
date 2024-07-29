import type { IApp } from '@plumber/types'

import * as React from 'react'
import { useQuery } from '@apollo/client'
import { Box, Center } from '@chakra-ui/react'

import AppRow from '@/components/AppRow'
import Container from '@/components/Container'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_CONNECTED_APPS } from '@/graphql/queries/get-connected-apps'

const APPS_TITLE = 'Apps'

export default function Applications(): React.ReactElement {
  const { data, loading } = useQuery(GET_CONNECTED_APPS)

  const apps: IApp[] = data?.getConnectedApps
  const hasApps = apps?.length

  return (
    <Box py={9}>
      <Container variant="page">
        <Box pl={9} mb={6}>
          <PageTitle title={APPS_TITLE} />
        </Box>

        {loading && (
          <Center>
            <PrimarySpinner data-test="apps-loader" fontSize="6xl" />
          </Center>
        )}

        {!loading && !hasApps && (
          <NoResultFound
            description="No apps found"
            action="Go to your pipes and create a pipe to connect apps and create an automated workflow"
          />
        )}

        {!loading &&
          apps?.map((app: IApp) => <AppRow key={app.name} application={app} />)}
      </Container>
    </Box>
  )
}
