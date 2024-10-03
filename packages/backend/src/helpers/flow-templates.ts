import type { IApp, IJSONObject, ITemplateStep } from '@plumber/types'

import get from 'lodash.get'

import apps from '@/apps'
import { TEMPLATES } from '@/db/storage'
import {
  STEP_ID_KEY,
  TILE_COL_DATA_KEY,
  TILE_ID_KEY,
  USER_EMAIL_KEY,
} from '@/db/storage/constants'
import type {
  FlowConfig,
  StepConfig,
} from '@/graphql/__generated__/types.generated'
import { createTableRows } from '@/models/dynamodb/table-row'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

// e.g. <<user_email>>, <<tile_col_data.Email>> to avoid clashes with {{step.}}
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
 * Converts all placeholders with the data value associated based on the map
 * E.g.
 * Placeholder replacement map:
 * {
 *  user_email: test@open.gov.sg,
 *  tile_table_id: '123',
 *  tile_col_data: {
 *    name: 'jack',
 *    email: 'jack@open.gov.sg',
 *  }
 * }
 *
 * Parameters before:
 * {
 *  body: This is my email: <<user_email>>, this is my table id: <<tile_table_id>>
 *  body2: Row name: <<tile_col_data.name>>, row email: <<tile_col_data.email>>
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
 * 2. <<tile_col_data.col_name>>, the column name value will be replaced with the col id.
 * 3. <<tile_table_id>> will be replaced with the tile id if created
 * 4. <<step_id_position>>, this will be replaced by one of the newly created template step id
 *
 * To create a new placeholder in the template:
 * In constants.ts file:
 *  - Add a key for the placeholder in constant.ts e.g. user_email
 *  - Add a new placeholder based on the key in i.e. <<user_email>>
 *
 * In this function:
 *  - Add data for this key in the `placeholderReplacementMap`
 *
 * Note: A nested placeholder would be needed if data is nested
 * Refer to <<tile_col_data.col_name>> for an example.
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

  const { name: flowName, steps, tileTemplateData } = template
  const flowConfig: FlowConfig = {
    templateConfig: {
      templateId,
    },
  }

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: flowName,
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
    const placeholderReplacementMap: IJSONObject = {
      [USER_EMAIL_KEY]: user.email,
      [TILE_ID_KEY]: tableId,
      [TILE_COL_DATA_KEY]: columnNameToIdMap,
    }

    // patch formId and tileId if present
    const formUrl = steps[0]?.sampleUrl ?? ''
    const formId = formUrl.slice(-FORM_ID_LENGTH)
    if (formId || tableId) {
      await flow.$query(trx).patch({
        config: {
          ...flow.config, // keep demo config details if present
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
        appEventKey: triggerAppEventKey,
      },
    }
    // insert trigger step
    const triggerStep = await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      appKey: steps[0].appKey,
      key: steps[0].eventKey,
      parameters: steps[0].parameters ?? {},
      config: triggerStepConfig,
    })
    placeholderReplacementMap[STEP_ID_KEY(1)] = triggerStep.id

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
          appEventKey: actionAppEventKey,
        },
      }
      // insert action step
      const actionStep = await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: updatedParameters,
        config: actionStepConfig,
      })

      placeholderReplacementMap[STEP_ID_KEY(step.position)] = actionStep.id
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
