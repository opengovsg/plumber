import type { IGlobalVariable } from '@plumber/types'

export async function getTemplateData($: IGlobalVariable) {
  return await $.http.get('/v1/templates/:templateId', {
    urlPathParams: {
      templateId: $.step.parameters.templateId,
    },
  })
}
