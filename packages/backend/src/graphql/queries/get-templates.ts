import ExtendedQueryBuilder from '@/models/query-builder'
import Template from '@/models/template'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplates: QueryResolvers['getTemplates'] = async (
  _parent,
  params,
) => {
  const templateNames = params?.names
  const filterBuilder = (builder: ExtendedQueryBuilder<Template>) => {
    // case-insensitive matching
    if (templateNames && templateNames.length > 0) {
      builder.where((subBuilder) => {
        templateNames.forEach((name, index) => {
          if (index === 0) {
            subBuilder.where('name', 'ilike', `%${name}%`) // Start with 'where' for the first item
          } else {
            subBuilder.orWhere('name', 'ilike', `%${name}%`) // Use 'orWhere' for subsequent items
          }
        })
      })
    }
  }
  return await Template.query().where(filterBuilder).withGraphFetched({
    steps: true,
  })
}

export default getTemplates
