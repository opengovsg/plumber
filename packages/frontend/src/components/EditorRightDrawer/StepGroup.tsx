import { IFlow, IStep } from '@plumber/types'

import { FunctionComponent, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, Flex } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { areAllIfThenBranchesCompleted, isIfThenStep } from '@/helpers/toolbox'

import Error from '../FlowStepGroup/Content/Error'
import IfThen from '../FlowStepGroup/Content/IfThen'
import { ContentProps } from '../FlowStepGroup/Content/types'

interface StepGroupProps {
  iconUrl?: string
  flow: IFlow
  steps: IStep[]
  collapsed: boolean
  onOpen: () => void
  onClose: () => void
}

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

const ifThenHelpMessage = 'Customise what happens in each of your branches.'

export default function StepGroup(props: StepGroupProps) {
  const { flow, steps, collapsed, onClose } = props
  const isTemplatedFlow = !!flow.config?.templateConfig?.templateId
  const { StepContent, isStepGroupCompleted } = useMemo(
    () => getStepContent(steps),
    [steps],
  )

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

      <StepContent flow={flow} steps={steps} onClose={onClose} />
    </Flex>
  )
}
