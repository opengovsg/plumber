import { IStep } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiDuplicate } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Tooltip } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import { EditorContext } from '@/contexts/Editor'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

interface DuplicateStepButtonProps {
  isNested?: boolean
  step: IStep
  /** Skip FlowStep’s hover-reveal CSS — parent already controls visibility. */
  alwaysVisible?: boolean
}

export default function DuplicateStepButton(props: DuplicateStepButtonProps) {
  const { isNested, step, alwaysVisible = false } = props

  const { flow, isMobile, onDrawerOpen, setCurrentStepId } =
    useContext(EditorContext)

  // TODO: use onCreateStep from EditorContext instead
  const [createStep] = useMutation(CREATE_STEP, { refetchQueries: [GET_FLOW] })
  const onDuplicateStep = useCallback(async () => {
    const duplicateConfig = {
      ...(step.config?.approval && {
        approval: step.config?.approval,
      }),
      ...(step.config?.stepName && {
        stepName: `[COPY] ${step.config.stepName}`,
      }),
    }

    const mutationInput = {
      previousStep: {
        id: step.id,
      },
      flow: {
        id: flow.id,
        updatedAt: flow.updatedAt,
      },
      appKey: step.appKey,
      key: step.key,
      connection: { id: step.connection?.id },
      parameters: { ...step.parameters },
      config: duplicateConfig,
    }

    const createdStep = await createStep({
      variables: { input: mutationInput },
    })

    const newStep = createdStep.data.createStep
    setCurrentStepId(newStep.id)
    onDrawerOpen()
  }, [flow, step, createStep, setCurrentStepId, onDrawerOpen])

  const {
    cancelRef,
    isWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave,
  } = useUnsavedChanges({
    onProceed: onDuplicateStep,
  })

  return (
    <>
      <Tooltip label="Duplicate step" hasArrow>
        <IconButton
          boxSize={isNested ? 6 : 8}
          onClick={(event) => {
            event.stopPropagation()
            handleProceed()
          }}
          variant="clear"
          aria-label="Duplicate Step"
          colorScheme="secondary"
          icon={<BiDuplicate />}
          minHeight={isNested ? 6 : 8}
          minWidth={isNested ? 6 : 8}
          className={
            isMobile || alwaysVisible ? undefined : 'hover-remove-button'
          }
          visibility={isMobile || alwaysVisible ? 'visible' : 'hidden'}
        />
      </Tooltip>
      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={handleLeave}
      />
    </>
  )
}
