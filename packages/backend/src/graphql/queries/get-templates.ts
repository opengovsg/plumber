import { TEMPLATES } from '@/db/storage'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = (_parent, params) => {
  const tag = params?.tag
  // retrieve all non-demo templates if tag is not present
  if (!tag) {
    return TEMPLATES.filter((template) => template.tag !== 'demo')
  }
  return TEMPLATES.filter((template) => template.tag === tag)
}

export default getTemplates
