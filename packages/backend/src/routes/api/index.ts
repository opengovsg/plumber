import { Router } from 'express'

import {
  blockAdminOperations,
  requireAuthentication,
  setCurrentUserContext,
} from './middleware/authentication'
import adminRouter from './admin'
import appsRouter from './apps'
import chatRouter from './chat'
import dynamicDataRouter from './dynamic-data'

const router = Router()

// Apply authentication middleware to ALL API routes
// This mirrors how GraphQL handles authentication via context
router.use(setCurrentUserContext)
router.use(requireAuthentication)

// Mount routes that admins can access before blockAdminOperations
router.use('/apps', appsRouter)
router.use('/admin', adminRouter)

// Block admin mutations for all subsequent routes
router.use(blockAdminOperations)

router.use('/chat', chatRouter)
router.use('/dynamic-data', dynamicDataRouter)

// Future routes can be added here:
// router.use('/users', usersRouter)
// router.use('/analytics', analyticsRouter)
// etc.

export default router
