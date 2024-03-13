import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { type Template } from './types'

const dynamicData: IDynamicData = {
  key: 'getTemplateIds',
  name: 'Get Template IDs',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const { data } = await $.http.get('/v1/templates')

      if (!data?.templates) {
        return {
          data: [],
        }
      }

      // map to dynamic data format which is { name: string; value: string }
      return {
        data: data.templates.map((template: Template) => ({
          name: template.name,
          value: template.templateId.toString(),
        })),
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
