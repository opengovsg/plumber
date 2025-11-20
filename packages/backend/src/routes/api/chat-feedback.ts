import type { Request, Response } from 'express'
import { Router } from 'express'

import { langfuseClient } from '@/helpers/langfuse'
import logger from '@/helpers/logger'

import { getAuthenticatedContext } from './middleware/authentication'

interface ChatFeedbackRequest {
  traceId: string
  feedback: string
}

const handleChatFeedback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const context = getAuthenticatedContext(req)

  try {
    const { traceId, feedback } = req.body as ChatFeedbackRequest

    if (!traceId || !feedback) {
      res.status(400).json({ error: 'Trace ID and feedback are required' })
    }

    langfuseClient.score.create({
      traceId,
      id: `feedback-${traceId}-${context.currentUser.email}`,
      name: 'user-feedback',
      value: 0, // 1 for positive, 0 for negative
      comment: feedback,
    })
    res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Error submitting ai builder chat feedback:', error)
    res.status(400).json({ error: 'Failed to submit feedback' })
  }
}

const router = Router()

router.post('/', handleChatFeedback)

export default router
