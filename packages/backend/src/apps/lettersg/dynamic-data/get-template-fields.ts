import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

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

    try {
      const { data } = await $.http.get(`/v1/templates/${templateId}`)

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
