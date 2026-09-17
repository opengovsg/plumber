import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'

import { fetchCaseFields } from '../common/fetch-case-fields'
import { GatherSGCase, GatherSGError } from '../common/types'

import { resolveCaseUuid } from './get-case-fields'

const dynamicData: IDynamicData = {
  key: 'getCaseAttachmentFields',
  name: 'Get Case Attachment Fields',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const { caseUuid } = $.step.parameters
      const computedCaseUuid = await resolveCaseUuid($, caseUuid)
      if (!computedCaseUuid) {
        return { data: [] }
      }

      // Resolve the case type uuid from the case, then fetch its fields.
      const { data: caseData } = await $.http.get<{ data: GatherSGCase }>(
        `/cases/:caseUuid`,
        { urlPathParams: { caseUuid: computedCaseUuid } },
      )

      const { attachmentFields } = await fetchCaseFields({
        $,
        caseTypeUuid: caseData.data.type.uuid,
      })

      return {
        data: attachmentFields.map((field) => ({
          name: field.name,
          value: field.name,
        })),
      }
    } catch (error) {
      if (error instanceof HttpError && error.response?.status === 404) {
        const { message, code } =
          (error.response.data.error as GatherSGError) ?? {}
        if (code === 'RESOURCE_NOT_FOUND') {
          return { data: [], error: { message } }
        }
      }

      return {
        data: [],
        error: error?.message || error?.code || 'Unknown error',
      }
    }
  },
}

export default dynamicData
