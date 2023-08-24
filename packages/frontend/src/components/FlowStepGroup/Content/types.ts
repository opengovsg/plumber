import { type IFlow, type IStep } from '@plumber/types'

export interface ContentProps {
  flow: IFlow
  steps: IStep[]
}
