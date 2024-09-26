import { TEMPLATES } from '@/db/storage'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = () => {
  return TEMPLATES
}

export default getTemplates
