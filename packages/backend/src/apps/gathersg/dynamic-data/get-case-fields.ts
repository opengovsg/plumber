import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'
import computeParameters, { variableRegExp } from '@/helpers/compute-parameters'
import { getTestExecutionSteps } from '@/helpers/get-test-execution-steps'

import {
  fetchCaseData,
  fetchCaseFields,
  GatherSGCaseField,
} from '../common/fetch-case-data'
import { GatherSGError } from '../common/types'

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
      const { caseType: caseTypeUuid, caseUuid: rawCaseUuid } =
        $.step.parameters

      let targetCaseTypeUuid: string

      // Determine the case type UUID to use
      if (caseTypeUuid) {
        // if the case type uuid is provided, we use it directly
        // this happens for:
        // - create case
        targetCaseTypeUuid = caseTypeUuid as string
      } else {
        // if the case type uuid is not provided, we need to get it from the case uuid
        // this happens for:
        // - update case
        let caseUuid = rawCaseUuid as string

        if (typeof caseUuid === 'string' && caseUuid.match(variableRegExp)) {
          // if the case uuid is a variable, we need to compute the value
          const testExecutionSteps = await getTestExecutionSteps($.flow.id)
          const { caseUuid: computedCaseUuid } = computeParameters(
            { caseUuid },
            testExecutionSteps,
          )

          caseUuid = computedCaseUuid as string
        }

        // Fetch case data to get the case type UUID
        const caseData = await fetchCaseData({ $, caseUuid })

        // set the target case type uuid
        targetCaseTypeUuid = caseData.type.uuid
      }

      // Fetch case fields using the determined case type UUID
      const { filteredFields } = await fetchCaseFields({
        $,
        caseTypeUuid: targetCaseTypeUuid,
      })

      return processCaseFields(filteredFields)
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
