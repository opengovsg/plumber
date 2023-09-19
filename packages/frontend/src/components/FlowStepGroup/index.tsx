import { type IApp, type IFlow, type IStep } from '@plumber/types'

import { type FunctionComponent, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import FlowStepHeader from 'components/FlowStepHeader'
import { GET_APP } from 'graphql/queries/get-app'
import { areAllIfThenBranchesCompleted, isIfThenStep } from 'helpers/toolbox'

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
      hintAboveCaption: 'Action',
      caption: 'If... Then',
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
  flow: IFlow
  steps: IStep[]
  onOpen: () => void
  onClose: () => void
  collapsed: boolean
}

function FlowStepGroup(props: FlowStepGroupProps): JSX.Element {
  const { flow, steps, onOpen, onClose, collapsed } = props

  const { StepContent, hintAboveCaption, caption, isStepGroupCompleted } =
    useMemo(() => getStepContent(steps), [steps])

  const app: IApp = useQuery(GET_APP, {
    variables: { key: steps[0].appKey },
  })?.data?.getApp

  return (
    <FlowStepHeader
      iconUrl={app?.iconUrl}
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
