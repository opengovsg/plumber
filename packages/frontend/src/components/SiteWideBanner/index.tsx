import { useCallback, useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Box, IconButton } from '@mui/material'
import { getItemForSession, setItemForSession } from 'helpers/storage'
import useFormatMessage from 'hooks/useFormatMessage'

const BANNER_TEXT_ID = 'bannerText'

const SiteWideBanner = (): JSX.Element | null => {
  const formatMessage = useFormatMessage()
  // seems like this cant return empty string, so using _ as hacky empty string alternative
  const message = formatMessage(BANNER_TEXT_ID)
  const [showBanner, setShowBanner] = useState(false)
  useEffect(() => {
    const bannerTextStored = getItemForSession('hide-banner')
    setShowBanner(message !== bannerTextStored)
  }, [])

  const closeBanner = useCallback(() => {
    setShowBanner(false)
    setItemForSession('hide-banner', message)
  }, [])

  // this means the banner text is empty, so dont show the banner
  if (message === BANNER_TEXT_ID) {
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
        aligntItems: 'center',
        position: 'relative',
        a: {
          color: 'white',
          marginX: '4px',
          textDecoration: 'underline',
        },
      }}
    >
      {message}
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
