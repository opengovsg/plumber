import { useCallback, useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import { Box, IconButton } from '@mui/material'
import { getItemForSession, setItemForSession } from 'helpers/storage'
import useFormatMessage from 'hooks/useFormatMessage'

const SiteWideBanner = (): JSX.Element => {
  const formatMessage = useFormatMessage()
  const message = formatMessage('bannerText')
  const [showBanner, setShowBanner] = useState(false)
  useEffect(() => {
    const bannerTextStored = getItemForSession('hide-banner')
    setShowBanner(message !== bannerTextStored)
  }, [])

  const closeBanner = useCallback(() => {
    setShowBanner(false)
    setItemForSession('hide-banner', message)
  }, [])

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
