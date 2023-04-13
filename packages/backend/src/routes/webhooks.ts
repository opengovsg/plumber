import { IRequest } from '@plumber/types'

import express, {
  NextFunction,
  RequestHandler,
  Response,
  Router,
} from 'express'
import multer from 'multer'

import appConfig from '../config/app'
import webhookHandler from '../controllers/webhooks/handler'
import logger from '../helpers/logger'
import morgan from '../helpers/morgan'

const router = Router()
const upload = multer()

router.use(morgan)
router.use(upload.none())

router.use(
  express.text({
    limit: appConfig.requestBodySizeLimit,
    verify(req, res, buf) {
      // eslint-disable-next-line prettier/prettier
      (req as IRequest).rawBody = buf
    },
  }),
)

const exposeError =
  (handler: RequestHandler) =>
  async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      logger.http({
        webhookUrl: req.url,
        body: req.body,
        headers: req.headers,
      })
      await handler(req, res, next)
    } catch (err) {
      logger.error(err)
      next(err)
    }
  }

router.get('/:flowId', exposeError(webhookHandler))
router.put('/:flowId', exposeError(webhookHandler))
router.patch('/:flowId', exposeError(webhookHandler))
router.post('/:flowId', exposeError(webhookHandler))

export default router
