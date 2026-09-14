import { IGlobalVariable } from '@plumber/types'

import { UNSUPPORTED_FIELDS } from './constants'

export type GatherSGCaseField = {
  name: string
  type: string
  optional: boolean
}

type GatherSGCaseFields = {
  data: {
    uuid: string
    name: string
    version: number
    fields: GatherSGCaseField[]
  }
}

export const fetchCaseFields = async ({
  $,
  caseTypeUuid,
}: {
  $: IGlobalVariable
  caseTypeUuid: string
}) => {
  const { data } = await $.http.get<GatherSGCaseFields>(
    `/caseTypes/:caseTypeUuid`,
    {
      urlPathParams: { caseTypeUuid },
    },
  )

  const filteredFields = data.data.fields.filter(
    ({ type }) => !UNSUPPORTED_FIELDS.includes(type),
  )

  const attachmentFields = data.data.fields.filter(
    ({ type }) => type === 'attachment',
  )

  return {
    filteredFields,
    attachmentFields,
    caseTypeName: data.data.name,
  }
}
