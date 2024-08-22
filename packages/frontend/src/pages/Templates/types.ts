import type { IJSONObject } from '@plumber/types'

export type Template = {
  id: string // primary key
  name: string
  description: string
  steps: TemplateStep[]
}

export type TemplateStep = {
  position: number // primary key, no need id for now
  templateId: string // foreign key
  appKey?: string
  eventKey?: string
  sampleUrl?: string // specific to template e.g. form or tile link
  parameters?: IJSONObject
}
