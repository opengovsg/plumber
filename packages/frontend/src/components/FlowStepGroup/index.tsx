import { type IFlow, type IStep } from '@plumber/types'

import { type FunctionComponent, useMemo } from 'react'

import FlowStepHeader from '@/components/FlowStepHeader'
import { areAllIfThenBranchesCompleted, isIfThenStep } from '@/helpers/toolbox'

import Error from './Content/Error'
import IfThen from './Content/IfThen'
import { type ContentProps } from './Content/types'

function getStepContent(steps: IStep[]): {
  StepContent: FunctionComponent<ContentProps>
  hintAboveCaption: string
  caption: string
  isStepGroupCompleted?: boolean
} {
  const [mainStep] = steps

  // FIXME (ogp-weeloong): Maybe figure out a better way to do dispatch...?
  if (isIfThenStep(mainStep)) {
    return {
      StepContent: IfThen,
      hintAboveCaption: 'Then',
      caption: 'If-then',
      isStepGroupCompleted: areAllIfThenBranchesCompleted(steps, 0),
    }
  }

  return {
    StepContent: Error,
    hintAboveCaption: 'Error',
    caption: `Unknown action ${mainStep.appKey}-${mainStep.key}`,
  }
}

interface FlowStepGroupProps {
  iconUrl?: string
  flow: IFlow
  steps: IStep[]
  onOpen: () => void
  onClose: () => void
  collapsed: boolean
}

function FlowStepGroup(props: FlowStepGroupProps): JSX.Element {
  const { iconUrl, flow, steps, onOpen, onClose, collapsed } = props

  const { StepContent, hintAboveCaption, caption, isStepGroupCompleted } =
    useMemo(() => getStepContent(steps), [steps])

  return (
    <FlowStepHeader
      iconUrl={iconUrl}
      caption={caption}
      hintAboveCaption={hintAboveCaption}
      onOpen={onOpen}
      onClose={onClose}
      collapsed={collapsed ?? false}
      isCompleted={isStepGroupCompleted}
    >
      <StepContent flow={flow} steps={steps} />
    </FlowStepHeader>
  )
}

export default FlowStepGroup
