import { TEMPLATES } from '@/db/storage'
import { DEMO_TEMPLATES } from '@/db/storage/demo-templates-data'

import type { QueryResolvers, Template } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = (_parent, params) => {
  const { isDemoTemplate, names } = params
  const templates: Template[] = isDemoTemplate ? DEMO_TEMPLATES : TEMPLATES

  if (!names || names.length === 0) {
    return templates
  }

  // case-insensitive matching
  return templates.filter((template) =>
    names.some((name) => template.name.toLowerCase() === name.toLowerCase()),
  )
}

export default getTemplates
