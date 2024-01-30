import { Navigate } from 'react-router-dom'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type TileLayoutProps = {
  publicLayout?: boolean
  children: React.ReactNode
}

export default function TileLayout({ children }: TileLayoutProps): JSX.Element {
  const { currentUser } = useAuthentication()

  if (!currentUser) {
    const redirectQueryParam = window.location.pathname + window.location.search
    return (
      <Navigate
        to={URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(redirectQueryParam))}
      />
    )
  }

  return <>{children}</>
}
