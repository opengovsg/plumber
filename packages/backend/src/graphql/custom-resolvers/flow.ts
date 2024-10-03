import { TEMPLATES } from '@/db/storage'

import type { Resolvers } from '../__generated__/types.generated'

type FlowResolver = Resolvers['Flow']

const template: FlowResolver['template'] = async (parent) => {
  const templateId = parent?.config?.templateConfig.templateId
  if (!templateId) {
    return null
  }
  return TEMPLATES.find((template) => template.id === templateId)
}

export default {
  template,
} satisfies Resolvers['Flow']
