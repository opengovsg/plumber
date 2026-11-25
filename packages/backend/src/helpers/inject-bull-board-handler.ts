import { ExpressAdapter } from '@bull-board/express'
import { Application } from 'express'

import appConfig from '@/config/app'

import { getLoggedInUser } from './auth'
import { forwardAsyncErrors } from './forward-async-errors'

export const verifyIsAdminMiddleware = forwardAsyncErrors(
  async (req, res, next) => {
    const user = await getLoggedInUser(req)
    if (user?.email !== appConfig.adminUserEmail) {
      res.sendStatus(401)
      return
    }
    next()
  },
)

const injectBullBoardHandler = async (
  app: Application,
  serverAdapter: ExpressAdapter,
) => {
  if (!appConfig.enableBullMQDashboard) {
    return
  }

  const queueDashboardBasePath = '/admin/queues'
  serverAdapter.setBasePath(queueDashboardBasePath)

  app.use(
    queueDashboardBasePath,
    verifyIsAdminMiddleware,
    serverAdapter.getRouter(),
  )
}

export default injectBullBoardHandler
