import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import HttpError from '@/errors/http'
import { VARIABLE_REGEX } from '@/helpers/check-step-parameters'
import { computeForEachParameters } from '@/helpers/compute-for-each-parameters'
import computeParameters from '@/helpers/compute-parameters'
import { getTestExecutionSteps } from '@/helpers/get-test-execution-steps'

import {
  GATHERSG_EMAIL_TYPES,
  GATHERSG_NUMBER_TYPES,
  GATHERSG_SELECTION_TYPES,
  GatherSGSelectionType,
} from '../common/constants'
import { fetchCaseFields, GatherSGCaseField } from '../common/fetch-case-fields'
import { GatherSGCase, GatherSGError } from '../common/types'

const getCaseUuidFromVariable = async (
  $: IGlobalVariable,
  variable: string,
) => {
  const testExecutionSteps = await getTestExecutionSteps($.flow.id)

  if (/items.columns/.test(variable)) {
    // if variable from for each, then we compute slightly differently
    const stepIdAndKeyPath = variable.replace(/{{step.|}}/g, '') as string
    const [stepId, ...keyPaths] = stepIdAndKeyPath.split('.')

    const executionStep = testExecutionSteps.find((executionStep) => {
      return executionStep.stepId === stepId
    })

    if (!executionStep) {
      return ''
    }

    return computeForEachParameters({
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
    return caseUuid
  }
}

const processCaseFields = (
  caseFields: GatherSGCaseField[],
): DynamicDataOutput => {
  return {
    data: caseFields.map((field) => {
      let type: 'string' | 'number' | 'email' | GatherSGSelectionType = 'string'
      if (GATHERSG_NUMBER_TYPES.includes(field.type)) {
        type = 'number'
      } else if (GATHERSG_EMAIL_TYPES.includes(field.type)) {
        type = 'email'
      } else if (
        (GATHERSG_SELECTION_TYPES as readonly string[]).includes(field.type)
      ) {
        // Keep Ownself Gather type keys so autofill sets Dropdown/Checkbox/Radio.
        type = field.type as GatherSGSelectionType
      }
      return {
        name: field.name,
        value: field.name,
        type,
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
        // account that case uuid can be pasted in the frontend
        // and may not always be a variable
        let computedCaseUuid = caseUuid as string

        if (
          typeof caseUuid === 'string' &&
          caseUuid.match(`^${VARIABLE_REGEX.source}$`)
        ) {
          // if the case uuid is a variable, we need to compute the value
          computedCaseUuid = (await getCaseUuidFromVariable(
            $,
            caseUuid,
          )) as string
        }

        // use the case uuid to fetch the case data to derive the case type uuid
        const { data: caseData } = await $.http.get<{ data: GatherSGCase }>(
          `/cases/:caseUuid`,
          {
            urlPathParams: { caseUuid: computedCaseUuid },
          },
        )

        const { filteredFields } = await fetchCaseFields({
          $,
          caseTypeUuid: caseData.data.type.uuid,
        })
        return processCaseFields(filteredFields)
      }

      // fallback to return empty array
      // user can still manually input the case field
      return {
        data: [],
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
