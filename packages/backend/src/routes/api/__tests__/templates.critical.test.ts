// Business rule: template search should only search for community templates if
// the user has opted in; if the user has NOT opted in, it should only show
// default templates. if the user opts in, it should search across all templates
import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  builtInTemplates: [{ id: 'built-in-template-id' }],
  getUserVisibleTemplates: vi.fn(),
  isPostHogFlagEnabled: vi.fn(),
  searchTemplates: vi.fn(),
}))
vi.mock('@/db/storage', () => ({ TEMPLATES: mocks.builtInTemplates }))
vi.mock('@/helpers/get-user-visible-templates', () => ({
  getUserVisibleTemplates: mocks.getUserVisibleTemplates,
}))
vi.mock('@/helpers/posthog', () => ({
  isPostHogFlagEnabled: mocks.isPostHogFlagEnabled,
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

describe('template search early access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchTemplates.mockResolvedValue([])
  })

  it('checks the community templates early access flag for the current user', async () => {
    mocks.isPostHogFlagEnabled.mockResolvedValue(false)

    await search({ query: 'reminders' })

    expect(mocks.isPostHogFlagEnabled).toHaveBeenCalledWith(
      'COMMUNITY_TEMPLATES_EARLY_ACCESS',
      'user-id',
    )
  })

  it('searches only default templates when the user has not opted in', async () => {
    mocks.isPostHogFlagEnabled.mockResolvedValue(false)

    await search({ query: 'reminders' })

    expect(mocks.getUserVisibleTemplates).not.toHaveBeenCalled()
    expect(mocks.searchTemplates).toHaveBeenCalledWith({
      query: 'reminders',
      templates: mocks.builtInTemplates,
    })
  })

  it('searches default and community templates when the user has opted in', async () => {
    const allTemplates = [
      { id: 'community-template-id' },
      ...mocks.builtInTemplates,
    ]
    mocks.isPostHogFlagEnabled.mockResolvedValue(true)
    mocks.getUserVisibleTemplates.mockResolvedValue(allTemplates)

    await search({ query: 'reminders' })

    expect(mocks.getUserVisibleTemplates).toHaveBeenCalledWith('user-id')
    expect(mocks.searchTemplates).toHaveBeenCalledWith({
      query: 'reminders',
      templates: allTemplates,
    })
  })
})
