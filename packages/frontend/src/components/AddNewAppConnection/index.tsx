import type { IApp } from '@plumber/types'

import * as React from 'react'
import { Link } from 'react-router-dom'
import { useLazyQuery } from '@apollo/client'
import SearchIcon from '@mui/icons-material/Search'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AppIcon from 'components/AppIcon'
import * as URLS from 'config/urls'
import { GET_APPS } from 'graphql/queries/get-apps'
import useFormatMessage from 'hooks/useFormatMessage'
import debounce from 'lodash/debounce'

function createConnectionOrFlow(app: IApp) {
  if (app.auth) {
    return URLS.APP_ADD_CONNECTION(app.key)
  }

  return URLS.CREATE_FLOW_WITH_APP(app.key)
}

type AddNewAppConnectionProps = {
  onClose: () => void
}

export default function AddNewAppConnection(
  props: AddNewAppConnectionProps,
): React.ReactElement {
  const { onClose } = props
  const theme = useTheme()
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('sm'))
  const formatMessage = useFormatMessage()
  const [appName, setAppName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [getApps, { data }] = useLazyQuery(GET_APPS, {
    onCompleted: () => {
      setLoading(false)
    },
  })

  const fetchData = React.useMemo(
    () => debounce((name) => getApps({ variables: { name } }), 300),
    [getApps],
  )

  React.useEffect(
    function fetchAppsOnAppNameChange() {
      setLoading(true)

      fetchData(appName)
    },
    [fetchData, appName],
  )

  React.useEffect(
    function cancelDebounceOnUnmount() {
      return () => {
        fetchData.cancel()
      }
    },
    [fetchData],
  )

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{formatMessage('apps.addNewAppConnection')}</DialogTitle>

      <Box px={3}>
        <FormControl
          variant="outlined"
          fullWidth
          size={matchSmallScreens ? 'small' : 'medium'}
        >
          <InputLabel htmlFor="search-app">
            {formatMessage('apps.searchApp')}
          </InputLabel>

          <OutlinedInput
            id="search-app"
            type="text"
            fullWidth
            autoFocus
            onChange={(event) => setAppName(event.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <SearchIcon
                  sx={{ color: (theme) => theme.palette.primary.main }}
                />
              </InputAdornment>
            }
            label={formatMessage('apps.searchApp')}
            data-test="search-for-app-text-field"
          />
        </FormControl>
      </Box>

      <DialogContent>
        <List sx={{ pt: 2, width: '100%' }}>
          {loading && (
            <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />
          )}

          {!loading &&
            data?.getApps?.map((app: IApp) => (
              <ListItem disablePadding key={app.name} data-test="app-list-item">
                <ListItemButton
                  component={Link}
                  to={createConnectionOrFlow(app)}
                >
                  <ListItemIcon sx={{ minWidth: 74 }}>
                    <AppIcon
                      color="transparent"
                      url={app.iconUrl}
                      name={app.name}
                    />
                  </ListItemIcon>

                  <ListItemText
                    primary={app.name}
                    primaryTypographyProps={{
                      sx: { color: (theme) => theme.palette.text.primary },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
        </List>
      </DialogContent>
    </Dialog>
  )
}
