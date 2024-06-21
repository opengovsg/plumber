import { IApp } from '@plumber/types'

import { forwardRef, useCallback, useMemo, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import type { LinkProps } from 'react-router-dom'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Box, CircularProgress, Divider } from '@chakra-ui/react'
import Grid from '@mui/material/Grid'
import AddNewAppConnection from 'components/AddNewAppConnection'
import AppRow from 'components/AppRow'
import ConditionalIconButton from 'components/ConditionalIconButton'
import Container from 'components/Container'
import NoResultFound from 'components/NoResultFound'
import PageTitle from 'components/PageTitle'
import SearchInput from 'components/SearchInput'
import * as URLS from 'config/urls'
import { GET_CONNECTED_APPS } from 'graphql/queries/get-connected-apps'

const APPS_TITLE = 'Apps'

export default function Applications() {
  const navigate = useNavigate()
  const [appName, setAppName] = useState<string>()
  const { data, loading } = useQuery(GET_CONNECTED_APPS, {
    variables: { name: appName },
  })

  const apps = data?.getConnectedApps
  const hasApps = apps?.length

  const onSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setAppName(event.target.value)
    },
    [],
  )

  const goToApps = useCallback(() => {
    navigate(URLS.APPS)
  }, [navigate])

  const NewAppConnectionLink = useMemo(
    () =>
      forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(function InlineLink(
        linkProps,
        ref,
      ) {
        return <Link ref={ref} to={URLS.NEW_APP_CONNECTION} {...linkProps} />
      }),
    [],
  )

  return (
    <Box py={3}>
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
              icon={<BiPlus />}
              data-test="add-connection-button"
            >
              Add connection
            </ConditionalIconButton>
          </Grid>
        </Grid>

        <Divider mt={[2, 0]} mb={2} />

        {loading && (
          <CircularProgress
            data-test="apps-loader"
            sx={{ display: 'block', margin: '20px auto' }}
          />
        )}

        {!loading && !hasApps && (
          <NoResultFound
            text="You don't have any connections yet."
            to={URLS.NEW_APP_CONNECTION}
          />
        )}

        {!loading &&
          apps?.map((app) => (
            <AppRow
              key={app.name}
              application={
                // TEMPORARY - FIXING THIS IN NEXT PR
                app as IApp
              }
            />
          ))}

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
