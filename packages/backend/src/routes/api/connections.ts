import type { Router as RouterType } from 'express'
import { Router } from 'express'
import { z } from 'zod/v4'

import { listConnectionsService } from '@/services/mcp/list-connections'
import type { AuthenticatedRequest } from '@/types/express/context'

const router: RouterType = Router()

const querySchema = z.object({
  appKey: z.string().min(1),
})

router.get('/', async (req: AuthenticatedRequest, res) => {
  const user = req.context.currentUser

  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  const { appKey } = parsed.data

  try {
    const connections = await listConnectionsService(user, appKey)
    res.json({
      data: connections.map((c) => ({ name: c.label, value: c.id })),
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
