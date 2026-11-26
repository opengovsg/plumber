import { TEMPLATES } from '@/db/storage'

import type { Resolvers } from '../__generated__/types.generated'

type TemplateResolver = NonNullable<Resolvers['Template']>

const isBuiltIn: NonNullable<TemplateResolver['isBuiltIn']> = (parent) =>
  TEMPLATES.some((template) => template.id === parent.id)

export default {
  isBuiltIn,
} satisfies TemplateResolver
