import { IStep } from '@plumber/types'

import { Fragment, useContext } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import FlowStep from '@/components/FlowStep'
import { EditorContext } from '@/contexts/Editor'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'

interface BranchProps {
  addStep: (
    previousStepId: string,
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  branchSteps: IStep[]
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

export default function Branch(props: BranchProps) {
  const { addStep, branchSteps, groupedSteps, stepsBeforeGroup } = props

  const {
    currentStepId,
    isDrawerOpen,
    isMobile,
    readOnly: isEditorReadOnly,
    onDrawerClose,
    onDrawerOpen,
    onUpdateStep,
    setCurrentStepId,
    setCurrentStepIndex,
  } = useContext(EditorContext)

  return (
    <Flex key={branchSteps[0].id} {...branchStyles.container}>
      <Box
        borderWidth="1px"
        border="none"
        p={0}
        bg="white"
        overflow="hidden"
        w={isDrawerOpen ? (isMobile ? '0px' : '100%') : '100%'}
        mb={2}
      >
        <Flex alignItems="center" borderRadius="inherit" w="full">
          {/* Branch name */}
          <Text textStyle="subhead-1" color="base.content.default">
            {branchSteps[0].parameters.branchName as string}
          </Text>

          {/* FIXME (kevinkim-ogp): make this only appear on hover to minimise confusion between delete entire branch and deleting branch steps */}
          {/* <Flex ml="auto">
            <IconButton
              boxSize={8}
              onClick={(event) => {
                // onDialogOpen()
                event.stopPropagation()
              }}
              variant="clear"
              aria-label="Delete branch"
              icon={<BiTrashAlt />}
            />
          </Flex> */}
        </Flex>
      </Box>
      {branchSteps.map((step, index) => {
        return (
          <Fragment key={`${step.id}-${stepsBeforeGroup.length + index}`}>
            <FlowStep
              step={step}
              isNested={true}
              isLastStep={index === branchSteps.length - 1}
              // FIXME (kevinkim-ogp): this is a temporary solution to ensure the step is collapsed when the drawer is closed
              collapsed={
                !isDrawerOpen && currentStepId === step.id
                  ? true
                  : currentStepId !== step.id
              }
              onOpen={() => {
                setCurrentStepId(step.id)
                setCurrentStepIndex(stepsBeforeGroup.length + index)
                onDrawerOpen()
              }}
              onClose={() => {
                setCurrentStepId(null)
                setCurrentStepIndex(null)
                onDrawerClose()
              }}
              onContinue={() => {
                // FIXME (kevinkim-ogp): this doesn't seem correct
                if (
                  index === stepsBeforeGroup.length - 1 &&
                  groupedSteps.length > 0
                ) {
                  setCurrentStepId(groupedSteps[0][0].id)
                } else {
                  setCurrentStepId(stepsBeforeGroup[index + 1]?.id)
                }
              }}
              onChange={onUpdateStep}
            />
            <HoverAddStepButton
              onClick={() => addStep(step.id, step?.appKey, step?.key)}
              isDisabled={isEditorReadOnly}
              isDrawerOpen={isDrawerOpen}
              isLastStep={index === branchSteps.length - 1}
            />
          </Fragment>
        )
      })}
    </Flex>
  )
}
