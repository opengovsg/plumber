import { Router } from 'express'
import { z } from 'zod/v4'

import { COMMUNITY_TEMPLATES_EARLY_ACCESS_FLAG } from '@/config/flags'
import { TEMPLATES } from '@/db/storage'
import { getUserVisibleTemplates } from '@/helpers/get-user-visible-templates'
import logger from '@/helpers/logger'
import { isPostHogFlagEnabled } from '@/helpers/posthog'
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
  const parsed = searchBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  try {
    const userId = req.context.currentUser.id
    // Community templates stay out of the AI request until the user opts in.
    const hasCommunityTemplates = await isPostHogFlagEnabled(
      COMMUNITY_TEMPLATES_EARLY_ACCESS_FLAG,
      userId,
    )
    const templateIds = await searchTemplates({
      query: parsed.data.query,
      templates: hasCommunityTemplates
        ? await getUserVisibleTemplates(userId)
        : TEMPLATES,
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
