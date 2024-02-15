import { Suspense, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { Center } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'
import { TILES_FEATURE_FLAG } from 'config/flags'
import * as URLS from 'config/urls'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import useAuthentication from 'hooks/useAuthentication'

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
        <Spinner />
      </Center>
    )
  }

  /**
   * For non public view, check if feature flag is enabled, otherwise redirect to 404
   */
  if (!publicLayout && !flags[TILES_FEATURE_FLAG]) {
    return <Navigate to={URLS.FOUR_O_FOUR} />
  }

  if (!publicLayout && !currentUser) {
    const redirectQueryParam = window.location.pathname + window.location.search
    return (
      <Navigate
        to={URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(redirectQueryParam))}
      />
    )
  }

  return <Suspense fallback={<></>}>{children}</Suspense>
}
