import { EMPTY_FLOWS_TEMPLATES, TEMPLATES } from '@/db/storage'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = (_parent, params) => {
  return params.isEmptyFlowsTemplates ? EMPTY_FLOWS_TEMPLATES : TEMPLATES
}

export default getTemplates
