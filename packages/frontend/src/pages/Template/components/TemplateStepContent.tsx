import type { IApp } from '@plumber/types'

import { BiQuestionMark } from 'react-icons/bi'
import { Card, Flex, Icon, Image, Link, Text } from '@chakra-ui/react'

import { TemplateStep } from '@/pages/Templates/types'

interface TemplateStepContentProps {
  app?: IApp
  templateStep: TemplateStep
}

const FALLBACK_EVENT_NAME = 'Sample Event'

export default function TemplateStepContent(props: TemplateStepContentProps) {
  const { app, templateStep } = props
  const { eventKey, position, sampleUrl, sampleUrlDescription } = templateStep
  // sanity check
  if (!app) {
    return <></>
  }

  // find event name based on triggers/actions of the app using position
  const eventName =
    position === 1
      ? app?.triggers?.find((trigger) => trigger.key === eventKey)?.name ??
        FALLBACK_EVENT_NAME
      : app?.actions?.find((trigger) => trigger.key === eventKey)?.name ??
        FALLBACK_EVENT_NAME

  return (
    <Card
      variant="outline"
      w="100%"
      p={4}
      display="flex"
      flexDir="row"
      alignItems="center"
      columnGap={4}
      borderRadius={8}
    >
      <Flex
        borderWidth={1}
        boxSize={16}
        borderColor="base.divider.strong"
        justifyContent="center"
        alignItems="center"
        borderRadius="0.25rem"
      >
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
            />
          }
        />
      </Flex>

      <Flex flexDir="column" rowGap={1.5}>
        <Text textStyle="body-2">{position === 1 ? 'When' : 'Then'}</Text>

        <Flex alignItems="center" columnGap={4}>
          <Text textStyle="subhead-1">{`${position}. ${eventName}`}</Text>
          <Link
            href={sampleUrl}
            target="blank"
            textStyle="caption-2"
            colorScheme="secondary"
          >
            {sampleUrlDescription}
          </Link>
        </Flex>
      </Flex>
    </Card>
  )
}
