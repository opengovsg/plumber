import { IStep } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiDuplicate } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Tooltip } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'

interface DuplicateStepButtonProps {
  isNested?: boolean
  step: IStep
}

/**
 * Helper function to update the flow in the cache
 */
function updateHandlerFactory(flowId: string, previousStepId: string) {
  return function createStepUpdateHandler(cache: any, mutationResult: any) {
    const { data } = mutationResult
    const { createStep: createdStep } = data
    const { getFlow: flow } = cache.readQuery({
      query: GET_FLOW,
      variables: { id: flowId },
    })

    // getFlow requires certain attributes to be returned
    const completeCreatedStep = {
      ...createdStep,
      iconUrl: null,
      webhookUrl: null,
      config: {
        stepName: null,
        templateConfig: {
          appEventKey: null,
        },
      },
      createdAt: new Date().toISOString(),
    }

    const steps = flow.steps.reduce((steps: any[], currentStep: any) => {
      if (currentStep.id === previousStepId) {
        return [...steps, currentStep, completeCreatedStep]
      }

      return [...steps, currentStep]
    }, [])

    cache.writeQuery({
      query: GET_FLOW,
      variables: { id: flowId },
      data: { getFlow: { ...flow, steps } },
    })
  }
}

export default function DuplicateStepButton(props: DuplicateStepButtonProps) {
  const { isNested, step } = props

  const { flow, isMobile, setCurrentStepId, setCurrentStepIndex } =
    useContext(EditorContext)

  const [createStep] = useMutation(CREATE_STEP, { refetchQueries: [GET_FLOW] })

  const onDuplicateStep = useCallback(async () => {
    const mutationInput = {
      previousStep: {
        id: step.id,
      },
      flow: {
        id: flow.id,
      },
      appKey: step.appKey,
      key: step.key,
      connection: { id: step.connection?.id },
      parameters: { ...step.parameters },
    }

    const createdStep = await createStep({
      variables: { input: mutationInput },
      update: updateHandlerFactory(flow.id, step.id),
    })

    const newStep = createdStep.data.createStep
    const newStepIndex = newStep.position - 1
    setCurrentStepId(newStep.id)
    setCurrentStepIndex(newStepIndex)
  }, [flow.id, step, createStep, setCurrentStepId, setCurrentStepIndex])

  /**
   * TODOs:
   * - handle warn on unsaved changes
   */
  return (
    <Tooltip label="Duplicate step" hasArrow>
      <IconButton
        boxSize={isNested ? 6 : 8}
        onClick={(event) => {
          event.stopPropagation()
          onDuplicateStep()
        }}
        variant="clear"
        aria-label="Duplicate Step"
        colorScheme="secondary"
        icon={<BiDuplicate />}
        minHeight={isNested ? 6 : 8}
        minWidth={isNested ? 6 : 8}
        className={isMobile ? undefined : 'hover-remove-button'}
        visibility={isMobile ? 'visible' : 'hidden'}
      />
    </Tooltip>
  )
}
