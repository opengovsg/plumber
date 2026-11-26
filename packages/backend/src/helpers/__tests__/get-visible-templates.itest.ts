import { beforeEach, describe, expect, it } from 'vitest'

import { getVisibleTemplates } from '@/helpers/get-visible-templates'
import Template from '@/models/template'
import User from '@/models/user'

describe('getVisibleTemplates', () => {
  let owner: User

  beforeEach(async () => {
    await Template.query().delete()
    owner = await User.query()
      .findOne({ email: 'tester@open.gov.sg' })
      .throwIfNotFound()
  })

  it('skips a template whose steps fail the template schema', async () => {
    const valid = await Template.query().insertAndFetch({
      name: 'Valid template',
      description: '',
      userId: owner.id,
    })
    const invalid = await Template.query().insertAndFetch({
      name: 'Invalid template',
      description: '',
      userId: owner.id,
    })
    await invalid.$relatedQuery('templateSteps').insert({
      data: { position: 0 },
    })

    const ids = (await getVisibleTemplates()).map(({ id }) => id)

    expect(ids).toContain(valid.id)
    expect(ids).not.toContain(invalid.id)
    await expect(Template.findOneById(invalid.id)).rejects.toThrow()
  })
})
