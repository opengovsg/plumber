import { TEMPLATES } from '@/db/storage'
import { getVisibleTemplates } from '@/helpers/get-visible-templates'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: NonNullable<QueryResolvers['getTemplates']> = async (
  _parent,
  params,
) => {
  const tag = params?.tag
  if (!tag) {
    // Community templates have no tags, so only an untagged query includes them.
    return getVisibleTemplates()
  }

  return TEMPLATES.filter((template) => {
    if (!template.tags) {
      return false
    }
    return template.tags.some((templateTag) => templateTag === tag)
  })
}

export default getTemplates
