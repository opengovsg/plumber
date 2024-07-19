import { Fragment, useCallback, useContext, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Divider, Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  extractBranchesWithSteps,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/helpers/toolbox'

import { ContentProps } from '../types'

import Branch from './Branch'
import { BranchContext } from './BranchContext'

export default function IfThen(props: ContentProps): JSX.Element {
  const { flow, steps } = props

  const { depth } = useContext(BranchContext)
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)
  const branchesWithSteps = useMemo(
    () => extractBranchesWithSteps(steps, depth),
    [steps, depth],
  )
  const numBranches = branchesWithSteps.length

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

    const branchStep = await createStep({
      variables: {
        input: {
          key: TOOLBOX_ACTIONS.IfThen,
          appKey: TOOLBOX_APP_KEY,
          previousStep: {
            id: steps[steps.length - 1].id,
          },
          flow: {
            id: flow.id,
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
            id: flow.id,
          },
        },
      },
    })
  }, [isAddingBranch, createStep, steps, flow.id, depth, numBranches])

  return (
    <Flex flexDir="column">
      {branchesWithSteps.map((branchSteps, index) => (
        <Fragment key={branchSteps[0].id}>
          <Branch flow={flow} steps={branchSteps} />
          {index < branchesWithSteps.length - 1 && (
            <Divider borderColor="base.divider.medium" />
          )}
        </Fragment>
      ))}
      <Button
        onClick={onAddBranch}
        isDisabled={isEditorReadOnly}
        leftIcon={<BiPlus />}
        m={4}
        variant="outline"
        w="fit-content"
      >
        Add branch
      </Button>
    </Flex>
  )
}
