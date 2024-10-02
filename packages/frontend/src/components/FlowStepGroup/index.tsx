import { type IFlow, type IStep } from '@plumber/types'

import { type FunctionComponent, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, Flex } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

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

const ifThenHelpMessage = 'Customise what happens in each of your branches.'

function FlowStepGroup(props: FlowStepGroupProps): JSX.Element {
  const { iconUrl, flow, steps, onOpen, onClose, collapsed } = props
  const isTemplatedFlow = !!flow.config?.templateConfig?.templateId

  const { StepContent, hintAboveCaption, caption, isStepGroupCompleted } =
    useMemo(() => getStepContent(steps), [steps])

  return (
    <Flex w="100%" flexDir="column">
      {/* Show infobox only if the step group is incomplete and from a template */}
      {!isStepGroupCompleted && isTemplatedFlow && (
        <Box boxShadow={collapsed ? undefined : 'sm'} borderRadius="lg">
          <Infobox
            icon={<BiInfoCircle />}
            variant="secondary"
            style={{
              borderBottomLeftRadius: '0',
              borderBottomRightRadius: '0',
            }}
          >
            {ifThenHelpMessage}
          </Infobox>
        </Box>
      )}

      <FlowStepHeader
        iconUrl={iconUrl}
        caption={caption}
        hintAboveCaption={hintAboveCaption}
        onOpen={onOpen}
        onClose={onClose}
        collapsed={collapsed ?? false}
        isCompleted={isStepGroupCompleted}
        isInfoboxPresent={!isStepGroupCompleted}
      >
        <StepContent flow={flow} steps={steps} />
      </FlowStepHeader>
    </Flex>
  )
}

export default FlowStepGroup
