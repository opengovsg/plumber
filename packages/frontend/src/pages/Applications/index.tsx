import type { IApp } from '@plumber/types'

import * as React from 'react'
import type { LinkProps } from 'react-router-dom'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'

import AddNewAppConnection from '@/components/AddNewAppConnection'
import AppRow from '@/components/AppRow'
import ConditionalIconButton from '@/components/ConditionalIconButton'
import Container from '@/components/Container'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import SearchInput from '@/components/SearchInput'
import * as URLS from '@/config/urls'
import { GET_CONNECTED_APPS } from '@/graphql/queries/get-connected-apps'
import useFormatMessage from '@/hooks/useFormatMessage'

const APPS_TITLE = 'Apps'

export default function Applications(): React.ReactElement {
  const navigate = useNavigate()
  const formatMessage = useFormatMessage()
  const [appName, setAppName] = React.useState<string>()
  const { data, loading } = useQuery(GET_CONNECTED_APPS, {
    variables: { name: appName },
  })

  const apps: IApp[] = data?.getConnectedApps
  const hasApps = apps?.length

  const onSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setAppName(event.target.value)
    },
    [],
  )

  const goToApps = React.useCallback(() => {
    navigate(URLS.APPS)
  }, [navigate])

  const NewAppConnectionLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(
        function InlineLink(linkProps, ref) {
          return <Link ref={ref} to={URLS.NEW_APP_CONNECTION} {...linkProps} />
        },
      ),
    [],
  )

  return (
    <Box sx={{ py: 3 }}>
      <Container variant="page">
        <Grid
          container
          sx={{ mb: [0, 3] }}
          columnSpacing={1.5}
          paddingLeft={[0, 4.5]}
          rowSpacing={3}
        >
          <Grid container item xs sm alignItems="center" order={{ xs: 0 }}>
            <PageTitle title={APPS_TITLE} />
          </Grid>

          <Grid item xs={12} sm="auto" order={{ xs: 2, sm: 1 }}>
            <SearchInput onChange={onSearchChange} />
          </Grid>

          <Grid
            container
            item
            xs="auto"
            sm="auto"
            alignItems="center"
            order={{ xs: 1, sm: 2 }}
          >
            <ConditionalIconButton
              type="submit"
              size="lg"
              component={NewAppConnectionLink}
              icon={<AddIcon />}
              data-test="add-connection-button"
            >
              {formatMessage('apps.addConnection')}
            </ConditionalIconButton>
          </Grid>
        </Grid>

        <Divider sx={{ mt: [2, 0], mb: 2 }} />

        {loading && (
          <CircularProgress
            data-test="apps-loader"
            sx={{ display: 'block', margin: '20px auto' }}
          />
        )}

        {!loading && !hasApps && (
          <NoResultFound
            text={formatMessage('apps.noConnections')}
            to={URLS.NEW_APP_CONNECTION}
          />
        )}

        {!loading &&
          apps?.map((app: IApp) => <AppRow key={app.name} application={app} />)}

        <Routes>
          <Route
            path="/new"
            element={<AddNewAppConnection onClose={goToApps} />}
          />
        </Routes>
      </Container>
    </Box>
  )
}
