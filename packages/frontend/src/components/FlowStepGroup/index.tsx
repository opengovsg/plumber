import { type IFlow, type IStep } from '@plumber/types'

import { type FunctionComponent, useMemo } from 'react'
import FlowStepHeader from 'components/FlowStepHeader'
import { isIfThenStep } from 'helpers/plumberToolbelt'
import useApps from 'hooks/useApps'

import Error from './Content/Error'
import IfThen from './Content/IfThen'
import { type ContentProps } from './Content/types'

function getStepContent(mainStep: IStep): {
  StepContent: FunctionComponent<ContentProps>
  hintAboveCaption: string
  caption: string
  // TODO: implement this in later PR.
  iconUrl?: string
} {
  // FIXME (ogp-weeloong): Maybe figure out a better way to do dispatch...?
  if (isIfThenStep(mainStep)) {
    return {
      StepContent: IfThen,
      hintAboveCaption: 'Action',
      caption: 'If... Then',
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
  const mainStep = steps[0]

  const { StepContent, hintAboveCaption, caption } = useMemo(
    () => getStepContent(mainStep),
    [mainStep],
  )

  // This will be removed in a later PR.
  const apps = useApps()
  const app = mainStep.appKey ? apps?.get(mainStep.appKey) : null

  return (
    <FlowStepHeader
      iconUrl={app?.rawApp?.iconUrl}
      caption={caption}
      hintAboveCaption={hintAboveCaption}
      onOpen={onOpen}
      onClose={onClose}
      collapsed={collapsed ?? false}
    >
      <StepContent flow={flow} steps={steps} />
    </FlowStepHeader>
  )
}

export default FlowStepGroup
