import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { Template } from './types'

const dynamicData: IDynamicData = {
  key: 'getTemplateIds',
  name: 'Get Template IDs',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const templateIdsMap: { name: string; value: string }[] = []

    try {
      const { data } = await $.http.get('/v1/templates')

      if (!data.templates) {
        return {
          data: [],
        }
      }

      data.templates.forEach((template: Template) => {
        templateIdsMap.push({
          name: template.name,
          value: template.templateId.toString(),
        })
      })

      return {
        data: templateIdsMap,
      }
    } catch (error) {
      return {
        data: [],
        error: error.message,
      }
    }
  },
}

export default dynamicData
