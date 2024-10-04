import { TEMPLATES } from '@/db/storage'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = (_parent, params) => {
  const tag = params?.tag
  if (!tag) {
    return TEMPLATES // retrieve all templates if tag is not present
  }

  return TEMPLATES.filter((template) => {
    if (!template.tags) {
      return false
    }
    return template.tags.some((templateTag) => templateTag === tag)
  })
}

export default getTemplates
