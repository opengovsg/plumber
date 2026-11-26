import type { Router } from '@remix-run/router'
import { createBrowserRouter } from 'react-router-dom'

import routes from '@/routes'

const router: Router = createBrowserRouter(routes)

export default router
