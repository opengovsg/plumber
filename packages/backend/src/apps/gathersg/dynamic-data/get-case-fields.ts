import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'
import { computeForEachParameters } from '@/helpers/compute-for-each-parameters'
import computeParameters, { variableRegExp } from '@/helpers/compute-parameters'
import { getTestExecutionSteps } from '@/helpers/get-test-execution-steps'

import { fetchCaseFields, GatherSGCaseField } from '../common/fetch-case-fields'
import { GatherSGCase, GatherSGError } from '../common/types'

const getCaseUuidFromVariable = async (
  $: IGlobalVariable,
  variable: string,
) => {
  let computedCaseUuid
  const testExecutionSteps = await getTestExecutionSteps($.flow.id)

  if (/items.columns/.test(variable)) {
    // if variable from for each, then we compute slightly differently
    const stepIdAndKeyPath = variable.replace(/{{step.|}}/g, '') as string
    const [stepId, ...keyPaths] = stepIdAndKeyPath.split('.')

    const executionStep = testExecutionSteps.find((executionStep) => {
      return executionStep.stepId === stepId
    })

    computedCaseUuid = computeForEachParameters({
      data: executionStep?.dataOut,
      keyPath: keyPaths.join('.'),
      executionSteps: testExecutionSteps,
      executionStep,
      stepId,
      forEachContext: {
        executionStepMetadata: testExecutionSteps[0].metadata,
        forEachStepPosition: 0,
        isForEachStep: true,
        stepPositions: {
          [stepId]: 0,
        },
      },
    })
  } else {
    const { caseUuid } = computeParameters(
      { caseUuid: variable },
      testExecutionSteps,
    )
    computedCaseUuid = caseUuid
  }

  return computedCaseUuid ?? '`'
}

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
      const { caseType: caseTypeUuid, caseUuid } = $.step.parameters

      if (caseTypeUuid) {
        // Fetch case fields using the determined case type UUID
        const { filteredFields } = await fetchCaseFields({
          $,
          caseTypeUuid: caseTypeUuid as string,
        })

        return processCaseFields(filteredFields)
      } else if (caseUuid) {
        if (typeof caseUuid === 'string' && caseUuid.match(variableRegExp)) {
          // if the case uuid is a variable, we need to compute the value
          const computedCaseUuid = await getCaseUuidFromVariable($, caseUuid)

          // use the case uuid to fetch the case data to derive the case type uuid
          const { data: caseData } = await $.http.get<{ data: GatherSGCase }>(
            `/cases/:caseUuid`,
            {
              urlPathParams: { caseUuid: computedCaseUuid as string },
            },
          )

          const { filteredFields } = await fetchCaseFields({
            $,
            caseTypeUuid: caseData.data.type.uuid,
          })
          return processCaseFields(filteredFields)
        }

        return {
          data: [],
        }
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
