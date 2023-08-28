import { type IFlow, type IStep } from '@plumber/types'

import { Flex, Text, useDisclosure } from '@chakra-ui/react'
import NestedEditor from 'components/FlowStepGroup/NestedEditor'

interface BranchProps {
  flow: IFlow
  steps: IStep[]
  defaultName: string
}

export default function Branch(props: BranchProps): JSX.Element {
  const { flow, steps, defaultName } = props
  const {
    isOpen: editorIsOpen,
    onOpen: openEditor,
    onClose: closeEditor,
  } = useDisclosure()

  return (
    <>
      <Flex
        onClick={openEditor}
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
        {/* TODO in next PR: delete branch button */}
      </Flex>
      <NestedEditor
        onClose={closeEditor}
        isOpen={editorIsOpen}
        flow={flow}
        steps={steps}
      />
    </>
  )
}
