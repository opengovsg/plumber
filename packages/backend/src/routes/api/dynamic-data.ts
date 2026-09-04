import type { IJSONObject } from '@plumber/types'
import type { Router as RouterType } from 'express'
import { Router } from 'express'
import { z } from 'zod/v4'

import { UserFacingError } from '@/errors/user-facing-error'
import {
  DynamicDataPrerequisiteError,
  getDynamicDataService,
} from '@/services/mcp/get-dynamic-data'
import type { AuthenticatedRequest } from '@/types/express/context'

const router: RouterType = Router()

const bodySchema = z.object({
  stepId: z.string().min(1),
  key: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
})

router.post('/', async (req: AuthenticatedRequest, res) => {
  // Auth: resolved from the session cookie via setCurrentUserContext +
  // requireAuthentication middleware applied to all /api/* routes.
  //
  // TODO(MCP): When exposing this endpoint via an MCP transport, resolve the
  // user from the MCP API key or OAuth token in the Authorization header
  // instead of the session cookie. The getDynamicDataService call below is
  // already transport-agnostic — only this user-resolution line changes.
  const user = req.context.currentUser

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  const { stepId, key, parameters } = parsed.data

  try {
    const data = await getDynamicDataService({
      user,
      stepId,
      key,
      parameters: parameters as IJSONObject | undefined,
    })
    res.json({ data })
  } catch (error) {
    if (error instanceof DynamicDataPrerequisiteError) {
      res
        .status(400)
        .json({ error: error.message, code: 'prerequisite_missing' })
    } else if (error instanceof UserFacingError) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

export default router
