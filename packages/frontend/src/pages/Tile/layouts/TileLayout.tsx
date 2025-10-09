import { Suspense } from 'react'

import RedirectToLogin from '@/components/RedirectToLogin'
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

  if (!publicLayout && !currentUser) {
    return <RedirectToLogin />
  }

  return <Suspense fallback={<></>}>{children}</Suspense>
}
