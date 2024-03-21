import { IGlobalVariable } from '@plumber/types'

export async function processMissingFields(
  $: IGlobalVariable,
): Promise<string[]> {
  try {
    const templateId = $.step.parameters.templateId as string
    const { data } = await $.http.get('/v1/templates/:templateId', {
      urlPathParams: {
        templateId,
      },
    })

    if (!data?.fields) {
      return []
    }
    const allTemplateFields: string[] = data.fields
    // follows subfield format for letterParams which is { field: string, value: string }
    const inputTemplateFields = $.step.parameters.letterParams as Record<
      string,
      string
    >[]

    // perform filter for fields that don't exist
    const inputFieldsSet: Set<string> = new Set()
    for (const param of inputTemplateFields) {
      inputFieldsSet.add(param['field'])
    }
    return allTemplateFields.filter((field) => !inputFieldsSet.has(field))
  } catch (err) {
    // not crucial so we don't alarm the user and return an empty array for the missing fields instead
    return []
  }
}
