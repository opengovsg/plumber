import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

export type GatherSGCaseTypeField = {
  type: string
  name: string
  optional: boolean
  maxLength: number
}

export type GatherSGCaseType = {
  active: boolean
  name: string
  uuid: string
  fields: GatherSGCaseTypeField[]
}

type GatherSGCaseTypes = {
  total: number
  data: GatherSGCaseType[]
}

const PAGE_SIZE = 50
const FIRST_PAGE = 1

const dynamicData: IDynamicData = {
  key: 'getCaseTypes',
  name: 'Get Case Types',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      // this caseTypes API has a max size of 50
      // while it is unlikely to have more than 50 case types
      // add the pagination pre-emptively to avoid potential errors
      const { data: firstResponse } = await $.http.get<GatherSGCaseTypes>(
        `/admin/caseTypes?page=${FIRST_PAGE}&size=${PAGE_SIZE}`,
      )

      const total = firstResponse.total ?? firstResponse.data.length
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

      const allCaseTypes: GatherSGCaseType[] = [...(firstResponse.data || [])]

      for (let page = FIRST_PAGE + 1; page <= totalPages; page++) {
        const { data: pageResponse } = await $.http.get<GatherSGCaseTypes>(
          `/admin/caseTypes?page=${page}&size=${PAGE_SIZE}`,
        )
        if (pageResponse?.data?.length) {
          allCaseTypes.push(...pageResponse.data)
        }
      }

      const caseTypes = allCaseTypes.map((caseType) => {
        return {
          name: caseType.name,
          value: caseType.uuid,
        }
      })

      return { data: caseTypes }
    } catch (error) {
      return {
        data: [],
        error: error?.message || error?.code || 'Unknown error',
      }
    }
  },
}

export default dynamicData
