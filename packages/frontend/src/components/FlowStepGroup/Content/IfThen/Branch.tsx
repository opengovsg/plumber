import { type IFlow, type IStep } from '@plumber/types'

import { useMemo } from 'react'
import { Flex, Text, useDisclosure } from '@chakra-ui/react'
import NestedEditor from 'components/FlowStepGroup/NestedEditor'
import {
  type StepDisplayOverridesContextData,
  StepDisplayOverridesProvider,
} from 'contexts/StepDisplayOverrides'

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

  const initialStep = steps[0]
  const initialStepDisplayOverride = useMemo<StepDisplayOverridesContextData>(
    () => ({
      [initialStep.id]: {
        hintAboveCaption: 'If... Then',
        caption: (initialStep.parameters.branchName as string) ?? defaultName,
        disableActionChanges: true,
      },
    }),
    [initialStep.id, initialStep.parameters.branchName, defaultName],
  )

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
      <StepDisplayOverridesProvider value={initialStepDisplayOverride}>
        <NestedEditor
          onClose={closeEditor}
          isOpen={editorIsOpen}
          flow={flow}
          steps={steps}
        />
      </StepDisplayOverridesProvider>
    </>
  )
}
