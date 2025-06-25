import * as React from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useMatch,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Box, Flex, Tab, TabList, Tabs, Text } from '@chakra-ui/react'

import AddAppConnection from '@/components/AddAppConnection'
import AppConnections from '@/components/AppConnections'
import AppFlows from '@/components/AppFlows'
import AppIcon from '@/components/AppIcon'
import Container from '@/components/Container'
import * as URLS from '@/config/urls'
import { GET_APP } from '@/graphql/queries/get-app'

type ApplicationParams = {
  appKey: string
  connectionId?: string
}

const ReconnectConnection = (props: any): React.ReactElement => {
  const { application, onClose } = props
  const { connectionId } = useParams() as ApplicationParams

  return (
    <AddAppConnection
      onClose={onClose}
      application={application}
      connectionId={connectionId}
    />
  )
}

export default function Application(): React.ReactElement | null {
  const connectionsPathMatch = useMatch({
    path: URLS.APP_CONNECTIONS_PATTERN,
    end: false,
  })
  const flowsPathMatch = useMatch({ path: URLS.APP_FLOWS_PATTERN, end: false })
  const { appKey } = useParams() as ApplicationParams
  const navigate = useNavigate()
  const { data, loading } = useQuery(GET_APP, { variables: { key: appKey } })

  const goToApplicationPage = () => navigate('connections')
  const app = data?.getApp || {}

  if (loading) {
    return null
  }

  const currentTabIndex = connectionsPathMatch ? 0 : flowsPathMatch ? 1 : 0

  return (
    <>
      <Container>
        <Flex gap={4} mb={3} px={4} alignItems="center">
          <AppIcon url={app.iconUrl} color={app.primaryColor} name={app.name} />
          <Text textStyle="h4">{app.name}</Text>
        </Flex>

        <Box borderColor="gray.200" mb={2}>
          <Tabs
            variant="line"
            index={currentTabIndex}
            onChange={(index) => {
              if (index === 0) {
                navigate(URLS.APP_CONNECTIONS(appKey))
              } else {
                navigate(URLS.APP_FLOWS(appKey))
              }
            }}
          >
            <TabList>
              <Tab
                as={Link}
                _focus={{
                  outline: 'none',
                }}
                to={URLS.APP_CONNECTIONS(appKey)}
                isDisabled={!app.auth}
              >
                Connections
              </Tab>

              <Tab
                as={Link}
                to={URLS.APP_FLOWS(appKey)}
                _focus={{
                  outline: 'none',
                }}
              >
                Pipes
              </Tab>
            </TabList>
          </Tabs>
        </Box>

        <Routes>
          <Route
            path={`${URLS.FLOWS}/*`}
            element={<AppFlows appKey={appKey} appName={app.name} />}
          />

          <Route
            path={`${URLS.CONNECTIONS}/*`}
            element={<AppConnections appKey={appKey} />}
          />

          <Route
            path="/"
            element={
              <Navigate
                to={
                  app.auth?.connectionType
                    ? URLS.APP_CONNECTIONS(appKey)
                    : URLS.APP_FLOWS(appKey)
                }
                replace
              />
            }
          />
        </Routes>
      </Container>

      <Routes>
        <Route
          path="/connections/add"
          element={
            <AddAppConnection onClose={goToApplicationPage} application={app} />
          }
        />

        {/* TODO: deprecate this route */}
        <Route
          path="/connections/:connectionId/reconnect"
          element={
            <ReconnectConnection
              application={app}
              onClose={goToApplicationPage}
            />
          }
        />
      </Routes>
    </>
  )
}
