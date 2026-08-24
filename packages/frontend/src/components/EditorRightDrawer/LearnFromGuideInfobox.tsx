import { Flex, HStack, Icon, Link, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import { IAction, ITrigger } from '@plumber/types'
import { MdLightbulbOutline, MdOpenInNew } from 'react-icons/md'

interface LearnFromGuideInfoboxProps {
  selectedActionOrTrigger: IAction | ITrigger | undefined
}

export default function LearnFromGuideInfobox(
  props: LearnFromGuideInfoboxProps,
) {
  const { selectedActionOrTrigger } = props
  const { linkToGuide } = selectedActionOrTrigger || {}

  if (!linkToGuide) {
    return null
  }

  return (
    <>
      <Infobox
        icon={<Icon as={MdLightbulbOutline} color="primary.500" />}
        style={{
          borderRadius: '0.25rem',
          backgroundColor: '#FEF8FB',
          marginBottom: '1rem',
        }}
      >
        <Flex flexDir={{ base: 'column', md: 'row' }} gap={2} flex={1}>
          Learn how to set this up!{' '}
          <Link href={linkToGuide} isExternal>
            <HStack spacing={1}>
              <Text>Read our guide</Text>
              <Icon as={MdOpenInNew} boxSize={4} />
            </HStack>
          </Link>
        </Flex>
      </Infobox>
    </>
  )
}
