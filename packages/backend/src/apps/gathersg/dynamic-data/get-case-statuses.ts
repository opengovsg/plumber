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
        data: caseStatuses.data.map((status) => ({
          name: status.name,
          value: status.name,
        })),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : undefined
      return {
        data: [],
        error: { message: message || code || 'Unknown error' },
      }
    }
  },
}

export default dynamicData
