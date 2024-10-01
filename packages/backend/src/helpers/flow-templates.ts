import type { IApp, IJSONObject, ITemplateStep } from '@plumber/types'

import get from 'lodash.get'

import apps from '@/apps'
import { TEMPLATES } from '@/db/storage'
import {
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  USER_EMAIL_PLACEHOLDER,
} from '@/db/storage/constants'
import type {
  FlowConfig,
  StepConfig,
} from '@/graphql/__generated__/types.generated'
import { createTableRows } from '@/models/dynamodb/table-row'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

// e.g. {{user_email}}, {{tile_col_data.Email}}
const PLACEHOLDER_REGEX = /\{\{[a-zA-Z0-9_.? ]+\}\}/
const FORM_ID_LENGTH = 24
const CREATE_APP_EVENT_KEY = (appKey?: string, eventKey?: string) =>
  `${appKey}_${eventKey}`
// chose app_event key since it is unique among all triggers and actions
const HELP_MESSAGE_APP_EVENT_KEY_SET = new Set([
  'formsg_newSubmission',
  'tiles_createTileRow',
  'tiles_findSingleRow',
  'tiles_updateSingleRow',
  'postman_sendTransactionalEmail',
  'slack_sendMessageToChannel',
  'telegram-bot_sendMessage',
])

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

  if (eventKey) {
    const event = app?.triggers
      ? app?.triggers.find((trigger) => trigger.key === eventKey)
      : app?.actions.find((action) => action.key === eventKey)
    if (!event) {
      throw new Error(
        `Invalid event key for ${templateName} template at step ${position}`,
      )
    }
  }
}

// This replaces the keys of columns which are names to the column ids for row data
// e.g. { Rating: 5 } --> { column_id: 5 }
function replaceColumnNamesWithIds(
  rowData: IJSONObject[],
  columnNameToIdMap: Record<string, string>,
) {
  const replacedRowData: IJSONObject[] = []
  for (const row of rowData) {
    const newRow: IJSONObject = {}
    for (const key in row) {
      if (!columnNameToIdMap[key]) {
        throw new Error(
          `Unable to find tiles column id for specified column name: ${key} when inserting row data`,
        )
      }
      const newKey = columnNameToIdMap[key]
      newRow[newKey] = row[key]
    }
    replacedRowData.push(newRow)
  }
  return replacedRowData
}

/**
 * This is a recursive function as parameters could be an object, array or string.
 * Note: This assumes that the placeholder appears once in each value.
 * E.g. {{user_email}} won't appear twice in the parameter value.
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
      // Replace the value (placeholder) if it matches the regex
      if (!PLACEHOLDER_REGEX.test(value)) {
        continue
      }

      const placeholderId = value.replace('{{', '').replace('}}', '')
      // placeholder could be nested with the dot notation e.g. tiles column data
      // use lodash get function to go into nested objects
      const placeholderValue = get(
        placeholderReplacementMap,
        placeholderId,
        null,
      )
      if (placeholderValue !== null) {
        parameters[key] = placeholderValue
      }
    }
  }
  return parameters
}

export async function createFlowFromTemplate(
  templateId: string,
  user: User,
  isAutoCreated: boolean,
): Promise<Flow> {
  const template = TEMPLATES.find((template) => template.id === templateId)
  // prevents user from creating any new template
  if (!template) {
    throw new Error('Invalid template id input')
  }

  // check if the template is a demo template first: affects name, config and logging only
  const { name: flowName, steps, tag, tileTemplateData } = template
  const isDemoTemplate = tag === 'demo'
  const flowConfig: FlowConfig = isDemoTemplate
    ? {
        demoConfig: {
          hasLoadedOnce: false,
          isAutoCreated,
          videoId: templateId, // template id is the same as demo video id for backwards compatibility
        },
      }
    : {
        templateConfig: {
          templateId,
        },
      }

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    // insert flow with template id in the demo or template config
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: isDemoTemplate ? `[DEMO] ${flowName}` : flowName,
      config: flowConfig,
    })

    validateAppAndEventKey(steps[0], flowName)
    // create a tile with its columns and rows first if template uses tiles
    let tableId: string | undefined
    const columnNameToIdMap: Record<string, string> = {}
    if (tileTemplateData) {
      const { name, columns, rowData } = tileTemplateData

      try {
        // Takes the format of { name: colName, position: index }
        const columnsToInsert = columns.map((column, index) => ({
          name: column,
          position: index,
        }))

        const table = await user.$relatedQuery('tables').insertGraph({
          name,
          role: 'owner',
          columns: columnsToInsert,
        })
        tableId = table.id

        // obtain a map of column name to the column id for easy replacement
        for (const tableColumn of table.columns) {
          columnNameToIdMap[tableColumn.name] = tableColumn.id
        }

        // replace column names with column ids for each row data and create table rows
        const newRowData = replaceColumnNamesWithIds(rowData, columnNameToIdMap)
        await createTableRows({ tableId, dataArray: newRowData })
      } catch (e) {
        logger.error(e)
        throw new Error('Creation of tile ran into an issue')
      }
    }

    // prepare placeholder map for replacement
    const placeholderReplacementMap = {
      [USER_EMAIL_PLACEHOLDER]: user.email,
      [TILE_ID_PLACEHOLDER]: tableId,
      [TILE_COL_DATA_PLACEHOLDER]: columnNameToIdMap,
    }

    // patch formId and tileId if present
    const formUrl = steps[0]?.sampleUrl ?? ''
    const formId = formUrl.slice(-FORM_ID_LENGTH)
    if (formId || tableId) {
      await flow.$query(trx).patch({
        config: {
          templateConfig: {
            ...flow.config.templateConfig,
            ...(formId && {
              formId,
            }),
            ...(tableId && {
              tileId: tableId,
            }),
          },
        },
      })
    }

    // add step template config only if help message exists for the app-event
    const triggerAppEventKey = CREATE_APP_EVENT_KEY(
      steps[0].appKey,
      steps[0].eventKey,
    )
    const triggerStepConfig: StepConfig = {
      templateConfig: {
        ...(HELP_MESSAGE_APP_EVENT_KEY_SET.has(triggerAppEventKey) && {
          appEventKey: triggerAppEventKey,
        }),
      },
    }
    // insert trigger step
    await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      appKey: steps[0].appKey,
      key: steps[0].eventKey,
      parameters: steps[0].parameters ?? {},
      config: triggerStepConfig,
    })

    // action step could have app or event key to be null due to if-then
    // insert action steps based on steps
    for (let i = 1; i < steps.length; i++) {
      const step: ITemplateStep = steps[i]
      validateAppAndEventKey(step, flowName)

      // replace all placeholder parameters in action steps only
      const updatedParameters = replacePlaceholdersInParameters(
        structuredClone(step.parameters ?? {}),
        placeholderReplacementMap,
      )

      // add step template config only if help message exists for the app-event
      const actionAppEventKey = CREATE_APP_EVENT_KEY(step.appKey, step.eventKey)
      const actionStepConfig: StepConfig = {
        templateConfig: {
          ...(HELP_MESSAGE_APP_EVENT_KEY_SET.has(actionAppEventKey) && {
            appEventKey: actionAppEventKey,
          }),
        },
      }
      // insert action step
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: updatedParameters,
        config: actionStepConfig,
      })
    }

    logger.info('Flow created from template', {
      event: 'templated-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      templateId,
      isDemoTemplate,
      isAutoCreated,
    })

    return flow
  })
}
