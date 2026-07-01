import { IStep } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { getMrfApprovalConfig } from '@/helpers/formsg'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import Branch from './Branch'
import { BranchContext } from './BranchContext'
import { ifThenStyles } from './styles'

interface IfThenProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

export default function IfThen(props: IfThenProps): JSX.Element {
  const { groupedSteps, stepsBeforeGroup } = props

  const { depth } = useContext(BranchContext)
  const { approvalBranches } = useContext(MrfContext)
  const {
    flow,
    flowId,
    readOnly: isEditorReadOnly,
    setCurrentStepId,
    onDrawerOpen,
  } = useContext(EditorContext)

  const numBranches = groupedSteps.length

  //
  // Handle branch creation
  //
  // Note: We're intentionally _not_ updating the UI to reflect isAddingBranch
  // because this mutation usually runs fast, and updating the UI for a split
  // second looks very disruptive.
  const [createStep, { loading: isAddingBranch }] = useMutation(CREATE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS)
  const onAddBranch = useCallback(async () => {
    if (isAddingBranch) {
      return
    }

    const lastBranch = groupedSteps[groupedSteps.length - 1]
    const lastBranchIfThen = lastBranch[0]
    const lastStep = lastBranch[lastBranch.length - 1]

    // The new branch is appended at the end of the block, so it takes over as
    // the last branch: it inherits the old last branch's step to jump to, and
    // the old last branch is repointed at the new branch's if-then. A legacy
    // last branch has no stored target, so the new branch inherits the "stop"
    // sentinel (null) — a legacy block runs to the end of the flow.
    const lastBranchStepIdToJumpTo =
      (lastBranchIfThen.parameters?.stepIdToJumpTo as
        | string
        | null
        | undefined) ?? null

    const approvalConfig = getMrfApprovalConfig({
      previousStep: lastStep,
      approvalBranches,
    })

    const branchStep = await createStep({
      variables: {
        input: {
          key: TOOLBOX_ACTIONS.IfThen,
          appKey: TOOLBOX_APP_KEY,
          previousStep: {
            id: lastStep.id,
          },
          flow: {
            id: flowId,
            updatedAt: flow.updatedAt,
          },
          parameters: {
            depth,
            branchName: `Branch ${numBranches + 1}`,
            stepIdToJumpTo: lastBranchStepIdToJumpTo,
          },
          config: {
            approval: approvalConfig,
          },
        },
      },
    })
    const newBranchStep = branchStep.data.createStep

    // Repoint the old last branch's step to jump to at the new branch.
    const updatedPositions = await updateStepPositions({
      variables: {
        input: {
          stepPositions: [
            {
              id: lastBranchIfThen.id,
              position: lastBranchIfThen.position,
              type: lastBranchIfThen.type as StepEnumType,
              stepIdToJumpTo: newBranchStep.id,
            },
          ],
          flow: { updatedAt: newBranchStep.flow.updatedAt },
        },
      },
    })

    // Add an empty blank step; otherwise users are confused how to add more
    // steps to the branch.
    await createStep({
      variables: {
        input: {
          previousStep: {
            id: newBranchStep.id,
          },
          flow: {
            id: flowId,
            updatedAt: updatedPositions.data?.updateStepPositions?.updatedAt,
          },
          config: {
            approval: approvalConfig,
          },
        },
      },
    })

    setCurrentStepId(newBranchStep.id)
    onDrawerOpen()
  }, [
    isAddingBranch,
    groupedSteps,
    createStep,
    updateStepPositions,
    flowId,
    depth,
    approvalBranches,
    numBranches,
    onDrawerOpen,
    setCurrentStepId,
    flow.updatedAt,
  ])

  return (
    <Flex flexDir="column" alignItems="center" gap={4} w="100%" mt={2}>
      <Flex flexDir="column" w="100%" px={2} gap={4}>
        {groupedSteps.map((branchSteps, index) => {
          return (
            <Branch
              key={branchSteps[0].id}
              branchSteps={branchSteps}
              stepsBeforeGroup={stepsBeforeGroup}
              previousBranchStep={
                index > 0 ? groupedSteps[index - 1][0] : undefined
              }
            />
          )
        })}
      </Flex>
      <Flex w="100%" px={4} pb={4}>
        <Button
          onClick={onAddBranch}
          isDisabled={isEditorReadOnly}
          leftIcon={<BiPlus />}
          {...ifThenStyles.addBranchButton}
        >
          Add branch
        </Button>
      </Flex>
    </Flex>
  )
}
