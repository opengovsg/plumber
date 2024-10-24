import { Box } from '@chakra-ui/react'

import AppBar from '@/components/AppBar'
import RedirectToLogin from '@/components/RedirectToLogin'
import SiteWideBanner from '@/components/SiteWideBanner'
import useAuthentication from '@/hooks/useAuthentication'

interface TransfersLayoutProps {
  children: React.ReactNode
}

export default function TransfersLayout(props: TransfersLayoutProps) {
  const { children } = props
  const { currentUser } = useAuthentication()

  if (!currentUser) {
    return <RedirectToLogin />
  }

  return (
    <>
      <SiteWideBanner />
      <AppBar />
      <Box>{children}</Box>
    </>
  )
}
