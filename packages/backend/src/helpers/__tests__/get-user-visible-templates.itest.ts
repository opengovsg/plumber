import { beforeEach, describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import { getUserVisibleTemplates } from '@/helpers/get-user-visible-templates'
import Template from '@/models/template'
import User from '@/models/user'

describe('getUserVisibleTemplates', () => {
  let owner: User
  let otherUser: User

  beforeEach(async () => {
    await Template.query().delete()
    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    otherUser = await User.query().insertAndFetch({
      email: `other-${Date.now()}@open.gov.sg`,
    })
  })

  it("includes the user's templates and built-in templates only", async () => {
    const ownTemplate = await Template.query().insertAndFetch({
      name: 'Own template',
      description: '',
      userId: owner.id,
    })
    const otherTemplate = await Template.query().insertAndFetch({
      name: 'Other template',
      description: '',
      userId: otherUser.id,
    })

    const ids = (await getUserVisibleTemplates(owner.id)).map(({ id }) => id)

    expect(ids).toEqual([ownTemplate.id, ...TEMPLATES.map(({ id }) => id)])
    expect(ids).not.toContain(otherTemplate.id)
  })
})
