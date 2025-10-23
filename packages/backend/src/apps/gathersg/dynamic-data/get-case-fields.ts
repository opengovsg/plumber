import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'

import { fetchCaseFields, GatherSGCaseField } from '../common/fetch-case-fields'
import { GatherSGCase, GatherSGError } from '../common/types'

const processCaseFields = (caseFields: GatherSGCaseField[]) => {
  return {
    data: caseFields.map((field) => {
      return {
        name: field.name,
        value: field.name,
      }
    }),
  }
}

const dynamicData: IDynamicData = {
  key: 'getCaseFields',
  name: 'Get Case Fields',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      const { caseType: caseTypeUuid } = $.step.parameters

      if (caseTypeUuid) {
        // Fetch case fields using the determined case type UUID
        const { filteredFields } = await fetchCaseFields({
          $,
          caseTypeUuid: caseTypeUuid as string,
        })

        return processCaseFields(filteredFields)
      }

      // BACKWARD COMPATIBILITY: this gets the case fields from the latest case in gathersg
      const { data: searchResult } = await $.http.post<{
        traceId: string
        total: number
        data: GatherSGCase[]
      }>('/cases/search', {
        page: 1,
        size: 1,
        sort: 'createdAt',
        order: 'desc',
      })

      /**
       * No cases found
       */
      if (searchResult.data.length === 0) {
        return {
          data: [],
        }
      }

      const caseFields: object = searchResult.data[0].fields
      const updatedCaseFields: { name: string; value: string }[] = []
      for (const [field, value] of Object.entries(caseFields)) {
        // Right now, we cannot support adding of array of objects as a value so just going to exclude to not cause errors unnecessarily
        if (Array.isArray(value)) {
          continue
        }
        updatedCaseFields.push({ name: field, value: field })
      }

      return {
        data: updatedCaseFields,
      }
    } catch (error) {
      if (error instanceof HttpError) {
        /**
         * error: {
         *  presentable: true,
         *  code: 'RESOURCE_NOT_FOUND',
         *  message: 'Unable to find the case.',
         *  title: 'Resource Not Found'
         * }
         */
        if (error.response?.status === 404) {
          const { message, code } =
            (error.response.data.error as GatherSGError) ?? {}

          if (code === 'RESOURCE_NOT_FOUND') {
            return {
              data: [],
              error: {
                message,
              },
            }
          }
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
