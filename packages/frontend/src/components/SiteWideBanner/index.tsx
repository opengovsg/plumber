import { useCallback, useContext, useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Box, IconButton } from '@mui/material'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { getItemForSession, setItemForSession } from 'helpers/storage'

const LAUNCH_DARKLY_BANNER_KEY = 'app_banner_display'
const EMPTY_BANNER_MESSAGE = ''

const SiteWideBanner = (): JSX.Element | null => {
  const [bannerMessage, setBannerMessage] = useState('')
  const [showBanner, setShowBanner] = useState(false)

  const launchDarkly = useContext(LaunchDarklyContext)

  useEffect(() => {
    const bannerMessageStored = getItemForSession('banner-text')
    // either banner should never be displayed based on LD or banner is 'closed'
    setShowBanner(
      !!bannerMessageStored && bannerMessageStored !== EMPTY_BANNER_MESSAGE,
    )
  }, [showBanner])

  // TODO: check why use callback when there are no dependencies?
  const closeBanner = useCallback(() => {
    setShowBanner(false)
    setItemForSession('banner-text', EMPTY_BANNER_MESSAGE)
  }, [])

  // check for feature flag (takes time to load) to display banner: by default it should be not visible
  useEffect(() => {
    if (
      launchDarkly.flags &&
      launchDarkly.flags[LAUNCH_DARKLY_BANNER_KEY] !== 'none' // this is the value set in LD
    ) {
      // message needs to be fetched everytime the page is re-rendered
      const message = launchDarkly.flags[LAUNCH_DARKLY_BANNER_KEY]
      setBannerMessage(message)
      if (getItemForSession('banner-text') === null) {
        // banner should only be enabled once at the start
        setShowBanner(true)
        setItemForSession('banner-text', message)
      }
    }
  }, [launchDarkly])

  // this means the banner text is empty, so dont show the banner even if session storage is not cleared yet!
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
        display: showBanner ? 'flex' : 'none',
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
