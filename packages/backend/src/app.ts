import '@/config/orm'

import { IRequest } from '@plumber/types'

import cors from 'cors'
import express from 'express'
import createError from 'http-errors'

import appConfig from '@/config/app'
import corsOptions from '@/config/cors-options'
import appAssetsHandler from '@/helpers/app-assets-handler'
import {
  createBullBoardHandler,
  serverAdapter,
} from '@/helpers/create-bull-board-handler'
import csp from '@/helpers/csp'
import errorHandler from '@/helpers/error-handler'
import injectBullBoardHandler from '@/helpers/inject-bull-board-handler'
import morgan from '@/helpers/morgan'
import webUIHandler from '@/helpers/web-ui-handler'
import router from '@/routes'

createBullBoardHandler(serverAdapter)

const app = express()

app.disable('x-powered-by')
app.use(csp)
app.use(morgan)
app.use(
  express.json({
    verify(req, _res, buf) {
      // eslint-disable-next-line prettier/prettier
      (req as IRequest).rawBody = buf
    },
    limit: appConfig.requestBodySizeLimit,
  }),
)
app.use(
  express.urlencoded({
    extended: false,
    limit: appConfig.requestBodySizeLimit,
    verify(req, _res, buf) {
      // eslint-disable-next-line prettier/prettier
      (req as IRequest).rawBody = buf
    },
  }),
)
app.use(cors(corsOptions))

injectBullBoardHandler(app, serverAdapter)

appAssetsHandler(app)

app.use('/', router)

webUIHandler(app)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

app.use(errorHandler)

export default app
