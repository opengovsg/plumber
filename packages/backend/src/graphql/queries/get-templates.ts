import { TEMPLATES } from '@/db/storage'
import { getUserVisibleTemplates } from '@/helpers/get-user-visible-templates'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = async (
  _parent,
  params,
  context,
) => {
  const tag = params?.tag
  if (!tag) {
    // User templates have no tags, so only an untagged query includes them.
    return getUserVisibleTemplates(context.currentUser.id)
  }

  return TEMPLATES.filter((template) => {
    if (!template.tags) {
      return false
    }
    return template.tags.some((templateTag) => templateTag === tag)
  })
}

export default getTemplates
