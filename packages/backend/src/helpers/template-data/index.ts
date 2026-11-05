import { tileTemplateDataHandler } from './tiles'
import type { TemplateDataHandler } from './types'

export type { TemplateDataHandler, TemplateDataResult } from './types'

// Keyed by `${appKey}_${eventKey}`.
const TEMPLATE_DATA_HANDLERS: Record<string, TemplateDataHandler> = {
  tiles_createTileRow: tileTemplateDataHandler,
  tiles_findSingleRow: tileTemplateDataHandler,
  tiles_findMultipleRows: tileTemplateDataHandler,
  tiles_updateSingleRow: tileTemplateDataHandler,
}

export function getTemplateDataHandler(
  appKey: string | null | undefined,
  eventKey: string | null | undefined,
): TemplateDataHandler | undefined {
  if (!appKey || !eventKey) {
    return undefined
  }
  return TEMPLATE_DATA_HANDLERS[`${appKey}_${eventKey}`]
}
