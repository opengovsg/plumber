import { describe, expect, it, vi } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import getTemplates from '@/graphql/queries/get-templates'
import { getVisibleTemplates } from '@/helpers/get-visible-templates'
import Context from '@/types/express/context'

vi.mock('@/helpers/get-visible-templates', () => ({
  getVisibleTemplates: vi.fn(),
}))

describe('getTemplates', () => {
  it('returns the visible templates for an admin request without a user', async () => {
    vi.mocked(getVisibleTemplates).mockResolvedValue(TEMPLATES)
    const context = {
      currentUser: null,
      isAdminOperation: true,
    } as unknown as Context

    const templates = await getTemplates({}, {}, context)

    expect(templates).toEqual(TEMPLATES)
  })
})
