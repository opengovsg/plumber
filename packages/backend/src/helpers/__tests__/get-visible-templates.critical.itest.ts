// Business rule: every user sees every community template, not only the ones
// they created. No early access opt-in is needed.
import { beforeEach, describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import { getVisibleTemplates } from '@/helpers/get-visible-templates'
import Template from '@/models/template'
import User from '@/models/user'

describe('community template visibility', () => {
  let creator: User
  let otherUser: User
  let template: Template

  beforeEach(async () => {
    await Template.query().delete()
    creator = await User.query()
      .findOne({ email: 'tester@open.gov.sg' })
      .throwIfNotFound()
    otherUser = await User.query().insertAndFetch({
      email: `other-${Date.now()}@open.gov.sg`,
    })
    template = await Template.query().insertAndFetch({
      name: 'Shared template',
      description: '',
      userId: creator.id,
    })
  })

  it("lists another user's template before the built-in templates", async () => {
    const ids = (await getVisibleTemplates()).map(({ id }) => id)

    expect(ids).toEqual([template.id, ...TEMPLATES.map(({ id }) => id)])
  })

  it('lets another user create a pipe from the template', async () => {
    const flow = await createFlowFromTemplate(template.id, otherUser)

    expect(flow.userId).toBe(otherUser.id)
  })
})
