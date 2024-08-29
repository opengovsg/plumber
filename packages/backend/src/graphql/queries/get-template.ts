import { DEMO_TEMPLATES } from '@/db/storage/demo-templates-data'
import { TEMPLATES } from '@/db/storage/templates-data'

import type { QueryResolvers, Template } from '../__generated__/types.generated'

const getTemplate: QueryResolvers['getTemplate'] = async (_parent, params) => {
  const { isDemoTemplate, id } = params
  const templates: Template[] = isDemoTemplate ? DEMO_TEMPLATES : TEMPLATES
  return templates.find((template) => template.id === id)
}

export default getTemplate
