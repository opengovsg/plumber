import { Router } from 'express'
import { z } from 'zod/v4'

import { TEMPLATES } from '@/db/storage'
import logger from '@/helpers/logger'
import {
  searchTemplates,
  TemplateSearchNotConfiguredError,
} from '@/services/template-search'

import { rateLimitApi } from './middleware/rate-limit'

const router = Router()

const searchBodySchema = z.object({
  query: z.string().trim().min(1).max(200),
})

router.post('/search', rateLimitApi, async (req, res) => {
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
