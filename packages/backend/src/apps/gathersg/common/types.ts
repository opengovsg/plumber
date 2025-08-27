import { type IJSONObject } from '@plumber/types'

export type GatherSGError = {
  presentable: boolean // not sure what this is
  code: string
  message: string
  title?: string
  details?: IJSONObject
}
