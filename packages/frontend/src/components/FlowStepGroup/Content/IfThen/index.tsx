import { IStep } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
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
  const {
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
  const onAddBranch = useCallback(async () => {
    if (isAddingBranch) {
      return
    }

    const lastGroup = groupedSteps[groupedSteps.length - 1]
    const lastStep = lastGroup[lastGroup.length - 1]

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
          },
          parameters: {
            depth,
            branchName: `Branch ${numBranches + 1}`,
          },
        },
      },
    })

    // Add an empty blank step; otherwise users are confused how to add more
    // steps to the branch.
    await createStep({
      variables: {
        input: {
          previousStep: {
            id: branchStep.data.createStep.id,
          },
          flow: {
            id: flowId,
          },
        },
      },
    })

    setCurrentStepId(branchStep.data.createStep.id)
    onDrawerOpen()
  }, [
    isAddingBranch,
    groupedSteps,
    createStep,
    flowId,
    depth,
    numBranches,
    onDrawerOpen,
    setCurrentStepId,
  ])

  return (
    <Flex flexDir="column" alignItems="center" gap={4} w="100%" mt={2}>
      <Flex direction="column" w="100%" px={4} gap={4}>
        {groupedSteps.map((branchSteps) => {
          return (
            <Branch
              key={branchSteps[0].id}
              branchSteps={branchSteps}
              groupedSteps={groupedSteps}
              stepsBeforeGroup={stepsBeforeGroup}
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
          pointerEvents={isEditorReadOnly ? 'none' : 'auto'}
        >
          Add branch
        </Button>
      </Flex>
    </Flex>
  )
}
