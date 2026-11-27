import { Flex, Link } from '@chakra-ui/react'
import type { IApp, IStep, ITemplateStep } from '@plumber/types'

import StepAppIcon from '@/components/FlowStep/components/StepAppIcon'
import StepNameAndDemo from '@/components/FlowStep/components/StepNameAndDemo'
import {
  flowStepStyles,
  NESTED_FLOW_STEP_HEIGHT,
} from '@/components/FlowStep/styles'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

interface TemplateStepContentProps {
  app?: IApp
  templateStep: ITemplateStep
  isNested?: boolean
}

const FALLBACK_EVENT_NAME = 'Sample Event'

export default function TemplateStepContent(props: TemplateStepContentProps) {
  const { app, templateStep, isNested = false } = props
  const { appKey, eventKey, position, sampleUrl, sampleUrlDescription } =
    templateStep

  const events = position === 1 ? app?.triggers : app?.actions
  const eventName =
    events?.find((event) => event.key === eventKey)?.name ?? FALLBACK_EVENT_NAME
  const stepName =
    templateStep.config?.stepName ||
    (!appKey && !eventKey ? 'Unconfigured step' : eventName)
  const width = getFlowStepHeaderWidth(false, false, isNested)

  return (
    <Flex flexDir="column" alignItems="flex-start" w={width} maxW="100%">
      <Flex
        {...flowStepStyles.container}
        w="100%"
        h={isNested ? NESTED_FLOW_STEP_HEIGHT : '64px'}
        _hover={{ bg: 'white', cursor: 'default' }}
      >
        <Flex {...flowStepStyles.topHeader} py={isNested ? 3 : 4}>
          <StepAppIcon
            app={app}
            step={{ key: eventKey } as IStep}
            isNested={isNested}
          />
          <StepNameAndDemo stepName={stepName} displayPosition={position} />
          {sampleUrlDescription && (
            <Link
              href={sampleUrl}
              target="_blank"
              textStyle="caption-2"
              colorScheme="secondary"
              flexShrink={0}
              ml={4}
            >
              {sampleUrlDescription}
            </Link>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}
