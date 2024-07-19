import { Suspense, useContext } from 'react'
import { Center } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import RedirectToLogin from '@/components/RedirectToLogin'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import useAuthentication from '@/hooks/useAuthentication'

type TileLayoutProps = {
  publicLayout?: boolean
  children: React.ReactNode
}

export default function TileLayout({
  children,
  publicLayout,
}: TileLayoutProps): JSX.Element {
  const { currentUser } = useAuthentication()
  const { flags, isLoading: isFlagsLoading } = useContext(LaunchDarklyContext)

  if (isFlagsLoading || !flags) {
    return (
      <Center h="100vh">
        <PrimarySpinner fontSize="6xl" />
      </Center>
    )
  }

  if (!publicLayout && !currentUser) {
    return <RedirectToLogin />
  }

  return <Suspense fallback={<></>}>{children}</Suspense>
}
