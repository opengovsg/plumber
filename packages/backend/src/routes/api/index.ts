import { Router } from 'express'

import chatRouter from './chat'

const router = Router()

// Mount individual API routes
router.use('/chat', chatRouter)

// Future routes can be added here:
// router.use('/users', usersRouter)
// router.use('/analytics', analyticsRouter)
// etc.

export default router
