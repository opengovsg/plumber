import { Router } from 'express'

import {
  requireAuthentication,
  setCurrentUserContext,
} from './middleware/authentication'
import chatRouter from './chat'

const router = Router()

// Apply authentication middleware to ALL API routes
// This mirrors how GraphQL handles authentication via context
router.use(setCurrentUserContext)
router.use(requireAuthentication)

// Mount individual API routes
router.use('/chat', chatRouter)

// Future routes can be added here:
// router.use('/users', usersRouter)
// router.use('/analytics', analyticsRouter)
// etc.

export default router
