import { useCallback, useContext, useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Box, IconButton } from '@mui/material'
import { BANNER_DISPLAY_FLAG } from 'config/flags'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { getItemForSession, setItemForSession } from 'helpers/storage'

const EMPTY_BANNER_MESSAGE = ''
const SESSION_STORAGE_HIDE_BANNER_KEY = 'hide-banner'

const SiteWideBanner = (): JSX.Element | null => {
  const [bannerMessage, setBannerMessage] = useState(EMPTY_BANNER_MESSAGE)
  const launchDarkly = useContext(LaunchDarklyContext)

  const closeBanner = useCallback(() => {
    setBannerMessage(EMPTY_BANNER_MESSAGE)
    setItemForSession(SESSION_STORAGE_HIDE_BANNER_KEY, bannerMessage)
  }, [bannerMessage])

  // check for feature flag (takes time to load) to display banner
  useEffect(() => {
    if (launchDarkly.flags) {
      // message needs to be fetched everytime the page is re-rendered
      const message = launchDarkly.flags[BANNER_DISPLAY_FLAG]
      const bannerMessageStored = getItemForSession(
        SESSION_STORAGE_HIDE_BANNER_KEY,
      )
      if (message !== bannerMessageStored) {
        setBannerMessage(message)
      } else {
        setBannerMessage(EMPTY_BANNER_MESSAGE)
      }
    }
  }, [launchDarkly])

  if (bannerMessage === EMPTY_BANNER_MESSAGE) {
    return null
  }
  return (
    <Box
      sx={{
        maxWidth: '100vw',
        padding: '0.5rem 3rem',
        textAlign: 'center',
        backgroundColor: 'primary.dark',
        color: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        a: {
          color: 'white',
          marginX: '4px',
          textDecoration: 'underline',
        },
      }}
    >
      {bannerMessage}
      <IconButton
        size="small"
        onClick={closeBanner}
        sx={{
          position: 'absolute',
          right: '1rem',
          color: 'white',
          padding: 0,
          height: 'calc(100% - 1rem)',
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

export default SiteWideBanner
