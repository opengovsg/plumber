import { type IJSONObject } from '@plumber/types'

export type GatherSGError = {
  presentable: boolean // not sure what this is
  code: string
  message: string
  title?: string
  details?: IJSONObject
}

/**
 * Subset of result
 */
export interface GatherSGCase {
  uuid: string
  createdAt: string
  updatedAt: string
  type: {
    uuid: string
    name: string
  }
  status: {
    uuid: string
    name: string
    color: string
    isFinal: boolean
  }
  caseRef: string
  fields: Record<string, string | string[] | null | number>
  tags: string[]
}
