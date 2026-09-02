import { Navigate } from 'react-router-dom'

import { getLoginRedirectHref } from '@/helpers/redirectToLogin'

export default function RedirectToLogin(): React.ReactElement {
  return <Navigate to={getLoginRedirectHref()} />
}
