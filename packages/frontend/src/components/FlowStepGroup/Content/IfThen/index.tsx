import { type IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Divider, Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { CREATE_STEP } from 'graphql/mutations/create-step'
import { GET_FLOW } from 'graphql/queries/get-flow'
import {
  isIfThenStep,
  TOOLBELT_ACTIONS,
  TOOLBELT_APP_KEY,
} from 'helpers/toolbelt'

import { ContentProps } from '../types'

import Branch from './Branch'
import { BranchContext } from './BranchContext'

/**
 * Extracts an array of step arrays, with each step array containing steps that
 * comprise a branch with depth === `currDepth`.
 *
 * Each step array contains:
 * 1. In the 1st element, a branch step (i.e. `key` === 'IfThen') with
 *    depth === `currDepth`.
 * 2. The remaining elements are steps belonging to that branch.
 */
function extractBranchesWithSteps(
  steps: IStep[],

  // We can't extract current depth from steps[0].parameters.depth - it may be
  // undefined if the user has just chosen "If... Then" via the
  // "Choose app & event" substep. We grab it from the context instead; it's
  // guaranteed to be correct via induction.
  //
  // Note: Only the _1st branch step_ of a branch series with the same depth
  // can have undefined depth. Other branches with the same depth have to be
  // created via our createBranch callback, which sets the depth explicitly.
  currDepth: number,
): Array<IStep[]> {
  const [firstStep, ...remainingSteps] = steps

  const result: Array<IStep[]> = []
  let branchWithSteps: IStep[] = [firstStep]

  for (const step of remainingSteps) {
    if (!isIfThenStep(step)) {
      branchWithSteps.push(step)
      continue
    }

    const stepDepth = parseInt(step.parameters.depth as string)

    // If depth is NaN, then this step is a nested branch that was just created
    // by the user via the "Choose app & event" substep. It cannot have a depth
    // <= currDepth; this needs us to cross a branch created with a createBranch
    // mutation _AND_ that branch also has its depth <= currDepth.
    //
    // Thus this step must always be part of the current branch, so we add it to
    // `branchWithSteps`.
    if (isNaN(stepDepth)) {
      branchWithSteps.push(step)
      continue
    }

    // Higher depth steps are definitely part of this branch, because we break
    // the loop if we encounter any steps with depth <= currDepth.
    if (stepDepth > currDepth) {
      branchWithSteps.push(step)
      continue
    }

    // We encountered another branch of the same depth, so restart the branch
    // step array.
    if (currDepth === stepDepth) {
      result.push(branchWithSteps)
      branchWithSteps = [step]
    }

    // We found a branch that is a sibling of our parent branch; this happens
    // when we are rendering nested branches. All further steps must not be part
    // of this branch, so just return.
    if (stepDepth < currDepth) {
      result.push(branchWithSteps)
      return result
    }
  }

  result.push(branchWithSteps)

  return result
}

export default function IfThen({ flow, steps }: ContentProps): JSX.Element {
  const { depth } = useContext(BranchContext)
  const branchesWithSteps = useMemo(
    () => extractBranchesWithSteps(steps, depth),
    [steps, depth],
  )
  const numBranches = branchesWithSteps.length

  const [createStep, { loading: isAddingBranch }] = useMutation(CREATE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const onAddBranch = useCallback(async () => {
    await createStep({
      variables: {
        input: {
          key: TOOLBELT_ACTIONS.IfThen,
          appKey: TOOLBELT_APP_KEY,
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
  }, [createStep, depth, numBranches, steps])

  return (
    <Flex flexDir="column">
      {branchesWithSteps.map((steps, index) => (
        <Fragment key={steps[0].id}>
          <Branch flow={flow} steps={steps} />
          {index < branchesWithSteps.length - 1 && (
            <Divider borderColor="base.divider.medium" />
          )}
        </Fragment>
      ))}
      <Button
        onClick={onAddBranch}
        isLoading={isAddingBranch}
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
