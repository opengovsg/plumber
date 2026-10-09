import { Router } from 'express'
import { z } from 'zod/v4'

import { TEMPLATE_SEARCH_FEATURE_FLAG } from '@/config/flags'
import { TEMPLATES } from '@/db/storage'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import {
  searchTemplates,
  TemplateSearchNotConfiguredError,
} from '@/services/template-search'
import type { AuthenticatedRequest } from '@/types/express/context'

import { rateLimitApi } from './middleware/rate-limit'

const router: Router = Router()

const searchBodySchema = z.object({
  query: z.string().trim().min(1).max(200),
})

router.post('/search', rateLimitApi, async (req: AuthenticatedRequest, res) => {
  // Hiding the input is not enough because each search is a paid model call.
  const isEnabled = await getLdFlagValue(
    TEMPLATE_SEARCH_FEATURE_FLAG,
    req.context.currentUser.email,
    false,
  )
  if (!isEnabled) {
    res.status(403).json({ error: 'Template search is not enabled' })
    return
  }

  const parsed = searchBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  try {
    const templateIds = await searchTemplates({
      query: parsed.data.query,
      templates: TEMPLATES,
    })
    res.json({ data: { templateIds } })
  } catch (error) {
    if (error instanceof TemplateSearchNotConfiguredError) {
      res.status(503).json({ error: 'Template search is not configured' })
      return
    }
    logger.error('Template search failed', {
      event: 'template-search-failed',
      error,
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
