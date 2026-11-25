import { useMutation } from '@apollo/client'
import { Tooltip } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import { IStep } from '@plumber/types'
import { usePostHog } from 'posthog-js/react'
import { useCallback, useContext, useRef } from 'react'
import { BiDuplicate } from 'react-icons/bi'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import { EditorContext } from '@/contexts/Editor'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

interface DuplicateStepButtonProps {
  isNested?: boolean
  step: IStep
  /** Skip FlowStep's hover-reveal CSS, since the parent controls visibility. */
  alwaysVisible?: boolean
}

export default function DuplicateStepButton(props: DuplicateStepButtonProps) {
  const posthog = usePostHog()
  const { isNested, step, alwaysVisible = false } = props

  const { flow, isMobile, onDrawerOpen, setCurrentStepId } =
    useContext(EditorContext)

  // TODO: use onCreateStep from EditorContext instead
  const [createStep] = useMutation(CREATE_STEP, { refetchQueries: [GET_FLOW] })
  // The `step` prop lags behind a save made from the unsaved changes dialog.
  const savedStepRef = useRef<IStep | null>(null)
  const onDuplicateStep = useCallback(async () => {
    const savedStep = savedStepRef.current
    savedStepRef.current = null
    const source = savedStep?.id === step.id ? { ...step, ...savedStep } : step
    const duplicateConfig = {
      ...(source.config?.approval && {
        approval: source.config?.approval,
      }),
      ...(source.config?.stepName && {
        stepName: `[COPY] ${source.config.stepName}`,
      }),
    }

    const mutationInput = {
      previousStep: {
        id: source.id,
      },
      flow: {
        id: flow.id,
        updatedAt: savedStep?.flow?.updatedAt ?? flow.updatedAt,
      },
      appKey: source.appKey,
      key: source.key,
      connection: { id: source.connection?.id },
      parameters: { ...source.parameters },
      config: duplicateConfig,
    }

    const createdStep = await createStep({
      variables: { input: mutationInput },
    })

    const newStep = createdStep.data.createStep
    posthog.capture('flow_step_duplicated')
    setCurrentStepId(newStep.id)
    onDrawerOpen()
  }, [flow, step, createStep, setCurrentStepId, onDrawerOpen, posthog])

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
        onLeave={(savedStep) => {
          savedStepRef.current = savedStep ?? null
          handleLeave()
        }}
      />
    </>
  )
}
