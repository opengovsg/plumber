import { type IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Divider, Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { CREATE_STEP } from 'graphql/mutations/create-step'
import {
  ACTIONS as TOOLBELT_ACTIONS,
  APP_KEY as TOOLBELT_APP_KEY,
  isIfThenStep,
} from 'helpers/plumberToolbelt'

import { ContentProps } from '../types'

import Branch from './Branch'
import { BranchDepthContext } from './BranchDepthContext'

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

    // Higher depth steps are definitely, because we break the loop if we encounter
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

  if (branchWithSteps.length > 0) {
    result.push(branchWithSteps)
  }

  return result
}

export default function IfThen({ flow, steps }: ContentProps): JSX.Element {
  const branchDepth = useContext(BranchDepthContext) ?? 0
  const branchesWithSteps = useMemo(
    () => extractBranchesWithSteps(steps, branchDepth),
    [steps, branchDepth],
  )

  const [createStep, { loading: isAddingBranch }] = useMutation(CREATE_STEP, {
    refetchQueries: ['GetFlow'],
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
            depth: branchDepth,
          },
        },
      },
    })
  }, [branchDepth, steps])

  return (
    // Nested If-Thens should have depth = depth + 1
    <BranchDepthContext.Provider value={branchDepth + 1}>
      <Flex flexDir="column">
        {branchesWithSteps.map((steps, index) => (
          <>
            <Branch
              flow={flow}
              steps={steps}
              defaultName={`Branch ${index + 1}`}
            />
            {index < branchesWithSteps.length - 1 && (
              <Divider borderColor="base.divider.medium" />
            )}
          </>
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
    </BranchDepthContext.Provider>
  )
}
