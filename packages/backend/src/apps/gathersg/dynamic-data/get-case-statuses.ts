import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

type GatherSGCaseStatus = {
  data: Array<{
    color: string
    isDefault: boolean
    isFinal: boolean
    name: string
    seq: number
    uuid: string
  }>
}

const dynamicData: IDynamicData = {
  key: 'getCaseStatuses',
  name: 'Get Case Statuses',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const { data: caseStatuses } = await $.http.get<GatherSGCaseStatus>(
        '/admin/caseStatuses',
      )

      return {
        data: caseStatuses.data.map(
          (status: GatherSGCaseStatus['data'][number]) => ({
            name: status.name,
            value: status.name,
          }),
        ),
      }
    } catch (error) {
      return {
        data: [],
        error: error?.message || error?.code || 'Unknown error',
      }
    }
  },
}

export default dynamicData
