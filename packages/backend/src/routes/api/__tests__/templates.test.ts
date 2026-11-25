import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getVisibleTemplates: vi.fn(),
  searchTemplates: vi.fn(),
}))
vi.mock('@/db/storage', () => ({ TEMPLATES: [] }))
vi.mock('@/helpers/get-visible-templates', () => ({
  getVisibleTemplates: mocks.getVisibleTemplates,
}))
vi.mock('@/services/template-search', () => ({
  searchTemplates: mocks.searchTemplates,
  TemplateSearchNotConfiguredError: class extends Error {},
}))
vi.mock('../middleware/rate-limit', () => ({ rateLimitApi: vi.fn() }))
vi.mock('@/helpers/logger', () => ({ default: { error: vi.fn() } }))

import router from '../templates'

async function search(body: unknown) {
  const req = {
    body,
    context: { currentUser: { id: 'user-id' } },
  } as unknown as Request
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  const handler = router.stack
    .find((layer) => layer.route?.path === '/search')!
    .route!.stack.at(-1)!.handle
  await handler(req, res as unknown as Response, vi.fn())
  return res
}

describe('template search endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the matching template ids', async () => {
    const templates = [
      {
        id: 'community-template-id',
        name: 'Mine',
        description: '',
        steps: [] as unknown[],
      },
    ]
    mocks.getVisibleTemplates.mockResolvedValue(templates)
    mocks.searchTemplates.mockResolvedValue(['community-template-id'])

    const res = await search({ query: 'my template' })

    expect(mocks.searchTemplates).toHaveBeenCalledWith({
      query: 'my template',
      templates,
    })
    expect(res.json).toHaveBeenCalledWith({
      data: { templateIds: ['community-template-id'] },
    })
  })
})
