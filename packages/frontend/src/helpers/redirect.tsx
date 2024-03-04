import { Navigate } from 'react-router-dom'

import * as URLS from '../config/urls'

export const redirectToLogin = (): JSX.Element => {
  const redirectQueryParam = window.location.pathname + window.location.search
  return (
    <Navigate
      to={URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(redirectQueryParam))}
    />
  )
}
