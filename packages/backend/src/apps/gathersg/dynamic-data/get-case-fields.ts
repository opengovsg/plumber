import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'
import computeParameters from '@/helpers/compute-parameters'
import ExecutionStep from '@/models/execution-step'

import { GatherSGError } from '../common/types'
import { validateDynamicFieldsAndThrowError } from '../common/validate-dynamic-fields'

const dynamicData: IDynamicData = {
  key: 'getCaseFields',
  name: 'Get Case Fields',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    try {
      // This action only allows a step variable which we have to attempt to compute the parameter value, thinking if there is a better way to do this
      // TODO: see if we can refresh the case fields from the API instead of using the cached data because right now, the user has to manually refresh the case fields to get the latest data
      const { caseUuid } = $.step.parameters
      if (!caseUuid) {
        return {
          data: [],
        }
      }

      const priorExecutionSteps = await ExecutionStep.query().where({
        execution_id: $.flow.testExecutionId,
        status: 'success',
      })

      const computedParameters = computeParameters(
        $.step.parameters,
        priorExecutionSteps,
      )
      const computedCaseUuid = computedParameters.caseUuid as string

      // Validation to prevent path traversals
      validateDynamicFieldsAndThrowError({
        caseUuid: computedCaseUuid,
      })

      const { data: responseData } = await $.http.get(`/cases/:caseUuid`, {
        urlPathParams: {
          caseUuid: computedCaseUuid,
        },
      })

      if (!responseData?.data) {
        return {
          data: [],
        }
      }

      const caseFields: object = responseData.data.fields
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
        if (error.response.status === 404) {
          const { message, code } = error.response.data.error as GatherSGError

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
        error: error.message,
      }
    }
  },
}

export default dynamicData
