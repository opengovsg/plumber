import { IGlobalVariable } from '@plumber/types'

import { UNSUPPORTED_FIELDS } from './constants'
import { GatherSGCase } from './types'

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
    `/admin/caseTypes/:caseTypeUuid`,
    {
      urlPathParams: { caseTypeUuid },
    },
  )

  const filteredFields = data.data.fields.filter(
    ({ type }) => !UNSUPPORTED_FIELDS.includes(type),
  )

  return {
    filteredFields,
    caseTypeName: data.data.name,
  }
}

export const fetchCaseData = async ({
  $,
  caseUuid,
}: {
  $: IGlobalVariable
  caseUuid: string
}) => {
  const { data } = await $.http.get<{ data: GatherSGCase }>(
    `/cases/:caseUuid`,
    {
      urlPathParams: { caseUuid },
    },
  )
  return data.data
}
