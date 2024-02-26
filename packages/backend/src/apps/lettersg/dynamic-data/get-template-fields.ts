import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { getApiBaseUrl } from '../common/api'

const dynamicData: IDynamicData = {
  key: 'getTemplateFields',
  name: 'Get Template Fields',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const { templateId } = $.step.parameters
    if (!templateId) {
      return {
        data: [],
      }
    }

    const apiKey = $.auth.data.apiKey as string
    const baseUrl = getApiBaseUrl(apiKey)

    try {
      const { data } = await $.http.get(`/v1/templates/${templateId}`, {
        baseURL: baseUrl,
        headers: {
          authorization: `Bearer ${$.auth.data.apiKey}`,
        },
      })

      if (!data) {
        return {
          data: [],
        }
      }

      const templateFields: string[] = data.fields

      return {
        data: templateFields.map((field: string) => ({
          name: field,
          value: field,
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
