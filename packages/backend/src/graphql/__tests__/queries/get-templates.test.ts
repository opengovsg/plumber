import { describe, expect, it, vi } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import getTemplates from '@/graphql/queries/get-templates'
import { getUserVisibleTemplates } from '@/helpers/get-user-visible-templates'
import Context from '@/types/express/context'

vi.mock('@/helpers/get-user-visible-templates', () => ({
  getUserVisibleTemplates: vi.fn(),
}))

describe('getTemplates', () => {
  it('returns the built-in templates for an admin request without a user', async () => {
    const context = {
      currentUser: null,
      isAdminOperation: true,
    } as unknown as Context

    const templates = await getTemplates(null, {}, context, null)

    expect(templates).toEqual(TEMPLATES)
    expect(getUserVisibleTemplates).not.toHaveBeenCalled()
  })
})
