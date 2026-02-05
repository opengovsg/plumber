import { Router } from 'express'

import {
  blockAdminOperations,
  requireAuthentication,
  setCurrentUserContext,
} from './middleware/authentication'
import chatRouter from './chat'

const router = Router()

// Apply authentication middleware to ALL API routes
// This mirrors how GraphQL handles authentication via context
router.use(setCurrentUserContext)
router.use(requireAuthentication)

// Routes that allow admin operations must be mounted BEFORE this middleware
// (none currently - all routes block admins by default)

// Block ALL admin mutations by default (admins are read-only)
// Individual routes that need admin write access should be mounted above
router.use(blockAdminOperations)

// Mount individual API routes
router.use('/chat', chatRouter)

// Future routes can be added here:
// router.use('/users', usersRouter)
// router.use('/analytics', analyticsRouter)
// etc.

export default router
