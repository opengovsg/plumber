import type { IApp, IJSONObject, ITemplateStep } from '@plumber/types'
import get from 'lodash.get'

import apps from '@/apps'
import { isMrfSubmissionStep } from '@/apps/toolbox/common/constants'
import { validateEndStepWrite } from '@/apps/toolbox/common/validate-end-step'
import { TEMPLATES } from '@/db/storage'
import {
  STEP_ID_KEY,
  STEP_ID_PLACEHOLDER,
  USER_EMAIL_KEY,
} from '@/db/storage/constants'
import type {
  FlowConfig,
  StepConfig,
} from '@/graphql/__generated__/types.generated'
import { getStepVersion } from '@/helpers/get-step-version'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'
import { getTemplateDataHandler } from './template-data'
import { remapTemplateStepConfig } from './template-step-config'

// e.g. <<user_email>>, <<tile_col_data_2.Email>> to avoid clashes with {{step.}}
const PLACEHOLDER_REGEX = /<<([a-zA-Z0-9_.? ]+)>>/g
const FORM_ID_LENGTH = 24
const CREATE_APP_EVENT_KEY = (appKey?: string, eventKey?: string) => {
  if (!appKey && !eventKey) {
    return '' // for empty step
  }
  return `${appKey}_${eventKey}`
}

function validateAppAndEventKey(step: ITemplateStep, templateName: string) {
  let app: IApp
  const { position, appKey, eventKey } = step
  if (appKey) {
    app = apps[appKey]
    if (!app) {
      throw new Error(
        `Invalid app key for ${templateName} template at step ${position}`,
      )
    }
  }

  if (step.templateData) {
    const handler = getTemplateDataHandler(appKey, eventKey)
    if (!handler?.schema.safeParse(step.templateData).success) {
      throw new Error(
        `Invalid template data for ${templateName} template at step ${position}`,
      )
    }
  }

  if (eventKey) {
    // Matches createFlowFromTemplate, which makes position 1 the trigger.
    const events = position === 1 ? app?.triggers : app?.actions
    const event = events?.find((event) => event.key === eventKey)
    if (!event) {
      throw new Error(
        `Invalid event key for ${templateName} template at step ${position}`,
      )
    }
  }
}

/**
 * This is a recursive function as parameters could be an object, array or string.
 * Converts all placeholders with the data value associated based on the map
 * E.g.
 * Placeholder replacement map:
 * {
 *  user_email: test@open.gov.sg,
 *  tile_table_id_2: '123',
 *  tile_col_data_2: {
 *    name: 'jack',
 *    email: 'jack@open.gov.sg',
 *  }
 * }
 *
 * Parameters before:
 * {
 *  body: This is my email: <<user_email>>, this is my table id: <<tile_table_id_2>>
 *  body2: Row name: <<tile_col_data_2.name>>, row email: <<tile_col_data_2.email>>
 * }
 *
 * Parameters after replacement:
 * {
 *  body: This is my email: test@open.gov.sg, this is my table id: 123
 *  body2: Row name: jack, row email: jack@oopen.gov.sg
 * }
 */
function replacePlaceholdersInParameters(
  parameters: IJSONObject,
  placeholderReplacementMap: IJSONObject,
): IJSONObject {
  // Iterate over each key in the object or array
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'object' && value !== null) {
      // If the value is another object or array, recurse into it
      parameters[key] = replacePlaceholdersInParameters(
        value as IJSONObject,
        placeholderReplacementMap,
      )
    } else if (typeof value === 'string') {
      parameters[key] = replaceAllPlaceholdersInValue(
        value,
        placeholderReplacementMap,
      )
    }
  }
  return parameters
}

function replaceAllPlaceholdersInValue(
  value: string,
  placeholderReplacementMap: IJSONObject,
): string {
  // Remove the '<<' and '>>' using the captured group directly
  return value.replace(PLACEHOLDER_REGEX, (match, capturedGroup) => {
    const placeholderId = capturedGroup.trim() // Remove any accidental spaces

    // placeholder could be nested with the dot notation e.g. tiles column data
    // use lodash `get` function to go into nested objects
    const replacementValue = get(placeholderReplacementMap, placeholderId, null)
    return replacementValue !== null ? replacementValue : match
  })
}

/**
 * IMPORTANT:
 * Right now, some parameters have to be replaced dynamically.
 * 1. <<user_email>> will be replaced with the actual user email
 * 2. <<tile_col_data_N.col_name>>, the column name value will be replaced with the col id
 *    of the tile created by the step at position N.
 * 3. <<tile_table_id_N>> will be replaced with the id of the tile created by the step at position N
 *    <<tile_col_pos_N.i>> works like 2., but refers to the column at index i.
 * 4. <<step_id_position>>, this will be replaced by one of the newly created template step id
 *
 * To create a new placeholder in the template:
 * In constants.ts file:
 *  - Add a key for the placeholder in constant.ts e.g. user_email
 *  - Add a new placeholder based on the key in i.e. <<user_email>>
 *
 * In this function:
 *  - Add data for this key in the `placeholderReplacementMap`, or return it
 *    from a template data handler in ./template-data
 *
 * Note: A nested placeholder would be needed if data is nested
 * Refer to <<tile_col_data_N.col_name>> for an example.
 */
export async function createFlowFromTemplate(
  templateId: string,
  user: User,
): Promise<Flow> {
  const template = TEMPLATES.find((template) => template.id === templateId)
  // prevents user from creating any new template
  if (!template) {
    throw new Error('Invalid template id input')
  }

  const { name: flowName, steps } = template
  // IMPORTANT: validate before handling template data, whose writes may be outside trx.
  for (const templateStep of steps) {
    validateAppAndEventKey(templateStep, flowName)
  }

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    const placeholderReplacementMap: IJSONObject = {
      [USER_EMAIL_KEY]: user.email,
    }

    // Handle all template data before inserting steps, since any step may
    // reference resources created for a later step.
    let dataTemplateConfig: Partial<FlowConfig['templateConfig']> = {}
    for (const { position, appKey, eventKey, templateData } of steps) {
      if (!templateData) {
        continue
      }
      const { placeholders, templateConfig } = await getTemplateDataHandler(
        appKey,
        eventKey,
      ).create({ user, templateData, position, trx })
      Object.assign(placeholderReplacementMap, placeholders)
      // The first step to set a key wins.
      dataTemplateConfig = { ...templateConfig, ...dataTemplateConfig }
    }

    const formUrl = steps[0]?.sampleUrl ?? ''
    const formId = formUrl.slice(-FORM_ID_LENGTH)
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: flowName,
      config: {
        templateConfig: {
          ...dataTemplateConfig,
          templateId,
          ...(formId && {
            formId,
          }),
        },
      } satisfies FlowConfig,
    })

    const templateStepIdMap: Record<string, string> = {}

    // step could have app or event key to be null due to if-then
    for (const templateStep of steps) {
      const { position, appKey, eventKey, parameters } = templateStep

      // replace all placeholder parameters in action steps only
      const updatedParameters = replacePlaceholdersInParameters(
        structuredClone(parameters ?? {}),
        placeholderReplacementMap,
      )

      // add step template config only if help message exists for the app-event
      const appEventKey = CREATE_APP_EVENT_KEY(appKey, eventKey)

      const step = await flow.$relatedQuery('steps', trx).insert({
        type: position === 1 ? 'trigger' : 'action',
        position,
        appKey,
        key: eventKey,
        parameters: updatedParameters,
        version: getStepVersion(appKey, eventKey),
        config: {
          templateConfig: {
            appEventKey,
          },
          ...structuredClone(templateStep.config ?? {}),
        } satisfies StepConfig,
      })

      placeholderReplacementMap[STEP_ID_KEY(position)] = step.id
      templateStepIdMap[STEP_ID_PLACEHOLDER(position)] = step.id
    }

    // Block boundaries can reference later steps or the block itself.
    const flowSteps = await flow
      .$relatedQuery('steps', trx)
      .orderBy('position', 'asc')
    for (const step of flowSteps) {
      step.config = remapTemplateStepConfig(step.config, templateStepIdMap)
    }
    for (const step of flowSteps) {
      if (step.config.approval) {
        const owner = flowSteps.find(
          (candidate) => candidate.id === step.config.approval.stepId,
        )
        if (!isMrfSubmissionStep(owner)) {
          throw new Error(
            'Template rejection branch must reference an MRF step',
          )
        }
      }
      if (step.config.endStepId !== undefined) {
        validateEndStepWrite({
          flowSteps,
          ifThenStepId: step.id,
          endStepId: step.config.endStepId,
          flowId: flow.id,
        })
      }
      if (step.config.endStepId !== undefined || step.config.approval) {
        await step.$query(trx).patch({ config: step.config })
      }
    }

    logger.info('Flow created from template', {
      event: 'templated-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      templateId,
    })

    return flow
  })
}
