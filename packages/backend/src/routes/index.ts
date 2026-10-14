import { Router } from 'express'

import graphQLInstance from '@/helpers/graphql-instance'

import apiRouter from './api'
import webhooksRouter from './webhooks'

const router: Router = Router()

router.use('/api', apiRouter)
router.use('/graphql', graphQLInstance)
router.use('/webhooks', webhooksRouter)

export default router
