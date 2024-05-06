import { ExpressAdapter } from '@bull-board/express'
import { Application, NextFunction, Request, Response } from 'express'

import appConfig from '@/config/app'

import { getLoggedInUser } from './auth'

export const verifyIsAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = await getLoggedInUser(req)
  if (user?.email !== appConfig.adminUserEmail) {
    res.sendStatus(401)
    return
  }
  next()
}

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
