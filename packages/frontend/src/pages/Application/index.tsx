import * as React from 'react'
import type { LinkProps } from 'react-router-dom'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useMatch,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useQuery } from '@apollo/client'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { useTheme } from '@mui/material/styles'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddAppConnection from 'components/AddAppConnection'
import AppConnections from 'components/AppConnections'
import AppFlows from 'components/AppFlows'
import AppIcon from 'components/AppIcon'
import ConditionalIconButton from 'components/ConditionalIconButton'
import Container from 'components/Container'
import PageTitle from 'components/PageTitle'
import * as URLS from 'config/urls'
import { GET_APP } from 'graphql/queries/get-app'
import useFormatMessage from 'hooks/useFormatMessage'

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
  const theme = useTheme()
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  })
  const formatMessage = useFormatMessage()
  const connectionsPathMatch = useMatch({
    path: URLS.APP_CONNECTIONS_PATTERN,
    end: false,
  })
  const flowsPathMatch = useMatch({ path: URLS.APP_FLOWS_PATTERN, end: false })
  const [searchParams] = useSearchParams()
  const { appKey } = useParams() as ApplicationParams
  const navigate = useNavigate()
  const { data, loading } = useQuery(GET_APP, { variables: { key: appKey } })

  const connectionId = searchParams.get('connectionId') || undefined
  const goToApplicationPage = () => navigate('connections')
  const app = data?.getApp || {}

  const NewConnectionLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(
        function InlineLink(linkProps, ref) {
          return (
            <Link
              ref={ref}
              to={URLS.APP_ADD_CONNECTION(appKey)}
              {...linkProps}
            />
          )
        },
      ),
    [appKey],
  )

  const NewFlowLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(
        function InlineLink(linkProps, ref) {
          return (
            <Link
              ref={ref}
              to={URLS.CREATE_FLOW_WITH_APP_AND_CONNECTION(
                appKey,
                connectionId,
              )}
              {...linkProps}
            />
          )
        },
      ),
    [appKey, connectionId],
  )

  if (loading) {
    return null
  }

  return (
    <>
      <Box sx={{ py: 3 }}>
        <Container variant="page">
          <Grid container sx={{ mb: 3 }} alignItems="center">
            <Grid item xs="auto" sx={{ mr: 3 }}>
              <AppIcon
                url={app.iconUrl}
                color={app.primaryColor}
                name={app.name}
              />
            </Grid>

            <Grid item xs>
              <PageTitle title={app.name} />
            </Grid>

            <Grid item xs="auto">
              <Routes>
                <Route
                  path={`${URLS.FLOWS}/*`}
                  element={
                    <ConditionalIconButton
                      type="submit"
                      size="lg"
                      component={NewFlowLink}
                      icon={<AddIcon />}
                    >
                      {formatMessage('app.createFlow')}
                    </ConditionalIconButton>
                  }
                />

                <Route
                  path={`${URLS.CONNECTIONS}/*`}
                  element={
                    <ConditionalIconButton
                      type="submit"
                      size="lg"
                      component={NewConnectionLink}
                      icon={<AddIcon />}
                      data-test="add-connection-button"
                    >
                      {formatMessage('app.addConnection')}
                    </ConditionalIconButton>
                  }
                />
              </Routes>
            </Grid>
          </Grid>

          <Grid container>
            <Grid item xs>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                  variant={matchSmallScreens ? 'fullWidth' : undefined}
                  value={
                    connectionsPathMatch?.pattern?.path ||
                    flowsPathMatch?.pattern?.path
                  }
                >
                  <Tab
                    label={formatMessage('app.connections')}
                    to={URLS.APP_CONNECTIONS(appKey)}
                    value={URLS.APP_CONNECTIONS_PATTERN}
                    disabled={!app.auth}
                    component={Link}
                  />

                  <Tab
                    label={formatMessage('app.flows')}
                    to={URLS.APP_FLOWS(appKey)}
                    value={URLS.APP_FLOWS_PATTERN}
                    component={Link}
                  />
                </Tabs>
              </Box>

              <Routes>
                <Route
                  path={`${URLS.FLOWS}/*`}
                  element={<AppFlows appKey={appKey} />}
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
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Routes>
        <Route
          path="/connections/add"
          element={
            <AddAppConnection onClose={goToApplicationPage} application={app} />
          }
        />

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
