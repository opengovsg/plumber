import { TEMPLATES } from '@/db/storage'

import type { Resolvers } from '../__generated__/types.generated'

type TemplateResolver = Resolvers['Template']

const isBuiltIn: TemplateResolver['isBuiltIn'] = (parent) =>
  TEMPLATES.some((template) => template.id === parent.id)

export default {
  isBuiltIn,
} satisfies TemplateResolver
