import { Box, Flex, Icon, Text } from '@chakra-ui/react'

import { flowStepGroupStyles } from '@/components/FlowStepGroup/styles'
import { getToolboxIcon } from '@/helpers/editor'

interface GroupedStepHeaderProps {
  stepGroupType: string
  stepGroupCaption: string
  isNested?: boolean
}

export default function GroupedStepHeader(props: GroupedStepHeaderProps) {
  const { stepGroupType, stepGroupCaption, isNested } = props

  return (
    <Box {...flowStepGroupStyles.header} w="100%">
      <Flex
        px={4}
        pt={4}
        alignItems="center"
        borderRadius="inherit"
        w="full"
        borderLeftWidth={0}
        borderRightWidth={0}
        role="group"
      >
        <Flex {...flowStepGroupStyles.iconWrapper}>
          {/* App icon */}
          <Icon
            boxSize={isNested ? 6 : 8}
            as={getToolboxIcon(stepGroupType)}
            color="primary.500"
          />
        </Flex>
        <Flex direction="column" align="start">
          <Flex alignItems="center" gap={2}>
            <Text textStyle="subhead-1" color="base.content.default">
              {stepGroupCaption}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )
}
