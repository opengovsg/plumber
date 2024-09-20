import type { IApp, IJSONObject } from '@plumber/types'

import apps from '@/apps'
import { TEMPLATES } from '@/db/storage'
import type {
  FlowConfig,
  TemplateStep,
} from '@/graphql/__generated__/types.generated'
import { createTableRows } from '@/models/dynamodb/table-row'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

function validateAppAndEventKey(step: TemplateStep, templateName: string) {
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
function replaceRowData(
  rowData: IJSONObject[],
  columnNameToIdMap: Record<string, string>,
) {
  const replacedRowData: IJSONObject[] = []
  for (const row of rowData) {
    const newRow: IJSONObject = {}
    for (const key in row) {
      if (!columnNameToIdMap[key]) {
        throw new Error(
          'Creation of tile ran into an issue, please contact support@plumber.gov.sg',
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
 * This replaces the column name to the column id in each tile event data.
 * This is because tiles apis uses column ids instead of the names
 * e.g. { columnName: <Name> } --> { columnId: <id> }
 * Then, generates parameters based on the format for each tile action
 */
function generateParametersForTilesAction(
  tileEventData: IJSONObject[],
  columnNameToIdMap: Record<string, string>,
  eventKey: string,
) {
  const updatedTileEventData: IJSONObject[] = JSON.parse(
    JSON.stringify(tileEventData),
  )

  for (const row of updatedTileEventData) {
    row['columnId'] = columnNameToIdMap[String(row['columnName'])]
    delete row['columnName']
  }

  // This follows the parameters format for each tile action
  switch (eventKey) {
    case 'createTileRow':
    case 'updateSingleRow':
      return {
        rowData: updatedTileEventData,
      } as IJSONObject
    case 'findSingleRow':
      return {
        filters: updatedTileEventData,
        returnLastRow: true,
      } as IJSONObject
  }
  return {} as IJSONObject
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
      const table = await user.$relatedQuery('tables').insertGraph({
        name,
        role: 'owner',
        columns,
      })
      tableId = table.id

      // obtain a map of column name to the column id for easy replacement
      for (const tableColumn of table.columns) {
        columnNameToIdMap[tableColumn.name] = tableColumn.id
      }

      // replace column names with column ids for each row data and create table rows
      const newRowData = replaceRowData(rowData, columnNameToIdMap)
      await createTableRows({ tableId, dataArray: newRowData })
    }

    // account for trigger/action step having null for app or event key
    // insert trigger step
    await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      appKey: steps[0].appKey,
      key: steps[0].eventKey,
      parameters: steps[0].parameters ?? {},
    })

    // action step could have app or event key to be null due to if-then
    // insert action steps based on steps
    for (let i = 1; i < steps.length; i++) {
      const step: TemplateStep = steps[i]
      validateAppAndEventKey(step, flowName)
      // replace all parameters with {{user_email}} to the current user email
      let updatedParameters = structuredClone(step.parameters ?? {})

      for (const [key, value] of Object.entries(updatedParameters)) {
        // ignore objects e.g. conditions because nothing to replace inside for now
        if (typeof value === 'string') {
          const substitutedValue = value.replaceAll(
            '{{user_email}}',
            user.email,
          )
          updatedParameters[key] = substitutedValue
        }
      }

      // perform tiles parameter update with tile template step data
      if (step.appKey === 'tiles') {
        // update all the parameters and map the column name to id
        updatedParameters['tableId'] = tableId
        updatedParameters = {
          ...generateParametersForTilesAction(
            step.tileTemplateStepData,
            columnNameToIdMap,
            step.eventKey,
          ),
          ...updatedParameters,
        }
      }

      // insert action step
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: updatedParameters,
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
