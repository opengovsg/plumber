import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserVisibleTemplates: vi.fn(),
  searchTemplates: vi.fn(),
}))
vi.mock('@/helpers/get-user-visible-templates', () => ({
  getUserVisibleTemplates: mocks.getUserVisibleTemplates,
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
    .find((layer) => layer.route?.path === '/search')
    ?.route.stack.at(-1).handle
  await handler(req, res as unknown as Response, vi.fn())
  return res
}

describe('template search endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("searches the current user's personal templates", async () => {
    const templates = [{ id: 'personal-template-id' }]
    mocks.getUserVisibleTemplates.mockResolvedValue(templates)
    mocks.searchTemplates.mockResolvedValue(['personal-template-id'])

    const res = await search({ query: 'my template' })

    expect(mocks.getUserVisibleTemplates).toHaveBeenCalledWith('user-id')
    expect(mocks.searchTemplates).toHaveBeenCalledWith({
      query: 'my template',
      templates,
    })
    expect(res.json).toHaveBeenCalledWith({
      data: { templateIds: ['personal-template-id'] },
    })
  })
})
