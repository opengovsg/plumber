import { type IFlow, type IStep } from '@plumber/types'

import { Flex, Text } from '@chakra-ui/react'

interface BranchProps {
  flow: IFlow
  steps: IStep[]
  defaultName: string
}

export default function Branch(props: BranchProps): JSX.Element {
  const { steps, defaultName } = props

  return (
    <Flex
      h={16}
      w="full"
      alignItems="center"
      px={4}
      _hover={{ bg: 'interaction.muted.main.hover', cursor: 'pointer' }}
      _active={{ bg: 'interaction.muted.main.active' }}
    >
      <Text textStyle="subhead-1">
        {steps[0].parameters.branchName
          ? String(steps[0].parameters.branchName)
          : defaultName}
      </Text>
      {/* TODO in next PR: nested editor, add branch implementation, delete branch button */}
    </Flex>
  )
}
