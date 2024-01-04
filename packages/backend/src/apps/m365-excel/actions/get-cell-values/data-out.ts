import type { IJSONObject } from '@plumber/types'

interface Result extends IJSONObject {
  cellAddress: string // In A1 notation
  cellValue: string
}

export interface DataOut extends IJSONObject {
  results: Result[]
}
