import { IRequest } from '@plumber/types'

import express, {
  NextFunction,
  RequestHandler,
  Response,
  Router,
} from 'express'
import multer from 'multer'

import appConfig from '@/config/app'
import webhookHandler from '@/controllers/webhooks/handler'
import logger from '@/helpers/logger'

const router = Router()
const uploadNone = multer().none()

router.use((req, res, next) => {
  uploadNone(req, res, (err) => {
    // file upload is not supported
    // handle error to prevent http 500 error
    if (err instanceof multer.MulterError) {
      logger.error({
        req: {
          body: req.body,
          headers: req.headers,
          url: req.url,
        },
        err,
        msg: 'Invalid request: multer error',
      })
      res.status(415).send('Invalid request, file upload is not supported.')
      return
    }
    next(err)
  })
})

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
