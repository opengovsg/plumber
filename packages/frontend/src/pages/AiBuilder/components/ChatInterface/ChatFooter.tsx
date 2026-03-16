import { Flex, Text } from '@chakra-ui/react'

import pairLogo from '@/assets/pair-logo.svg'
import { ImageBox } from '@/components/FlowStepConfigurationModal/ChooseAndAddConnection/ConfigureExcelConnection'

export default function ChatFooter() {
  return (
    <Flex justify="space-between" align="flex-end">
      <Flex flexDirection="column" gap={1}>
        <Text textStyle="caption-1" color="interaction.support.placeholder">
          This feature is new and still improving. It can make mistakes.
        </Text>
        <Text textStyle="caption-2" color="interaction.support.placeholder">
          Please check and edit the proposed workflow as needed.
        </Text>
      </Flex>
      <Flex gap={1} alignItems="center" bottom={4} left={4} zIndex={5}>
        <Text textStyle="caption-1" color="interaction.support.placeholder">
          Powered by{' '}
        </Text>
        <ImageBox imageUrl={pairLogo} boxSize={6} opacity={0.5} />
      </Flex>
    </Flex>
  )
}
