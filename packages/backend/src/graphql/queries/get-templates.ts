import { TEMPLATES } from '@/db/storage'
import Template from '@/models/template'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = async (
  _parent,
  params,
  context,
) => {
  const tag = params?.tag
  if (!tag) {
    // User templates have no tags, so only an untagged query includes them.
    const userTemplates = await Template.findAllForUser(context.currentUser.id)
    return [...userTemplates, ...TEMPLATES]
  }

  return TEMPLATES.filter((template) => {
    if (!template.tags) {
      return false
    }
    return template.tags.some((templateTag) => templateTag === tag)
  })
}

export default getTemplates
