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

export type CaseAttachment = {
  name: string
  mimeType: string
  size: number
  /* s3Id is absent before processAttachments runs, present once uploaded to S3.
   * Optional for backward compatibility with execution steps stored before S3 upload was added.
   */
  s3Id?: string
}
