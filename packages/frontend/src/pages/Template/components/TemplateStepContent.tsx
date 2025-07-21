import type { IApp, ITemplateStep } from '@plumber/types'

import { BiQuestionMark } from 'react-icons/bi'
import { Card, Flex, Icon, Image, Link, Text } from '@chakra-ui/react'

import { TOOLBOX_ACTION_TO_ICON_MAP } from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/ToolboxEvent'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

interface TemplateStepContentProps {
  app?: IApp
  templateStep: ITemplateStep
  isNested?: boolean
}

const FALLBACK_EVENT_NAME = 'Sample Event'
const IF_THEN_EVENT_NAME = 'Condition'
const FOR_EACH_EVENT_NAME = 'For each item'

export default function TemplateStepContent(props: TemplateStepContentProps) {
  const { app, templateStep, isNested } = props
  const { appKey, eventKey, position, sampleUrl, sampleUrlDescription } =
    templateStep
  // sanity check
  if (!app) {
    return <></>
  }

  const isTrigger = position === 1
  const isToolboxApp = appKey === TOOLBOX_APP_KEY
  const isIfThen = eventKey === TOOLBOX_ACTIONS.IfThen
  const isForEach = eventKey === TOOLBOX_ACTIONS.ForEach

  // find event name based on triggers/actions of the app using position
  const eventIcon =
    TOOLBOX_ACTION_TO_ICON_MAP[
      eventKey as keyof typeof TOOLBOX_ACTION_TO_ICON_MAP
    ] ?? BiQuestionMark
  let eventName = ''
  if (isTrigger) {
    eventName =
      app?.triggers?.find((trigger) => trigger.key === eventKey)?.name ??
      FALLBACK_EVENT_NAME
  } else {
    if (isIfThen) {
      eventName = IF_THEN_EVENT_NAME
    } else if (isForEach) {
      eventName = FOR_EACH_EVENT_NAME
    } else {
      eventName =
        app?.actions?.find((action) => action.key === eventKey)?.name ??
        FALLBACK_EVENT_NAME
    }
  }

  return (
    <Card
      variant="outline"
      w="100%"
      p={4}
      display="flex"
      flexDir="row"
      alignItems="center"
      columnGap={4}
      borderRadius="lg"
      h={isNested ? 12 : 16}
    >
      {isToolboxApp ? (
        <Icon boxSize={6} as={eventIcon} color="primary.500" ml={2} />
      ) : (
        <Image
          src={app?.iconUrl}
          boxSize={6}
          borderStyle="solid"
          fit="contain"
          fallback={
            <Icon
              boxSize={6}
              as={BiQuestionMark}
              color="base.content.default"
              ml={2}
            />
          }
          ml={2}
        />
      )}

      <Flex alignItems="center" columnGap={4}>
        <Text textStyle="subhead-1">{`${position}. ${eventName}`}</Text>
        <Link
          href={sampleUrl ?? ''}
          target="blank"
          textStyle="caption-2"
          colorScheme="secondary"
        >
          {sampleUrlDescription}
        </Link>
      </Flex>
    </Card>
  )
}
