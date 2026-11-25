// Business rule: template search covers the built-in templates and every
// user's community templates. No early access opt-in is needed.
import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  builtInTemplates: [
    {
      id: 'built-in-template-id',
      name: 'Built in',
      description: '',
      steps: [] as unknown[],
    },
  ],
  getVisibleTemplates: vi.fn(),
  searchTemplates: vi.fn(),
}))
vi.mock('@/db/storage', () => ({ TEMPLATES: mocks.builtInTemplates }))
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

describe('template search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchTemplates.mockResolvedValue([])
  })

  it('searches built-in and community templates without an opt-in', async () => {
    const communityTemplate = {
      id: 'community-template-id',
      name: 'Reminders',
      description: '',
      steps: [] as unknown[],
    }
    mocks.getVisibleTemplates.mockResolvedValue([
      communityTemplate,
      ...mocks.builtInTemplates,
    ])

    await search({ query: 'reminders' })

    expect(mocks.searchTemplates).toHaveBeenCalledWith({
      query: 'reminders',
      templates: [communityTemplate, ...mocks.builtInTemplates],
    })
  })
})
