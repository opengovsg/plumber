import type { IJSONObject } from '@plumber/types'

export interface ExcelWorksheet extends IJSONObject {
  name: string
  id: string
}

export interface ExcelTable extends IJSONObject {
  name: string
  id: string
}

export interface ExcelTableColumn extends IJSONObject {
  name: string
  value: string
}

// 30 min; see ExcelWorkbook's comment for context.
export const DEFAULT_CACHE_LIFETIME_SECONDS = 30 * 60

// 30 min; see ExcelWorkbook's comment for context.
export const SENSITIVITY_LABEL_CACHE_LIFETIME_SECONDS = 60
