import type { IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'

import ChooseConnectionSubstep from '@/components/ChooseConnectionSubstep'
import FlowSubstep from '@/components/FlowSubstep'
import Form from '@/components/Form'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsProvider } from '@/contexts/StepExecutions'
import { StepExecutionsToIncludeContext } from '@/contexts/StepExecutionsToInclude'
import { generateValidationSchema } from '@/helpers/editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

type StepProps = {
  step: IStep
  isLastStep: boolean
}

export default function Step(props: StepProps): React.ReactElement | null {
  const { step, isLastStep } = props

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const { allApps, onDrawerClose, onUpdateStep, testExecutionSteps } =
    useContext(EditorContext)

  // This includes all steps that run even after the current step, but within the same branch.
  const stepExecutionsToInclude = useContext(StepExecutionsToIncludeContext)
  const priorExecutionSteps = useMemo(
    () =>
      testExecutionSteps.filter(
        (stepExecution) =>
          stepExecutionsToInclude?.has(stepExecution.stepId) &&
          stepExecution.step.position < step.position,
      ),
    [step.position, stepExecutionsToInclude, testExecutionSteps],
  )

  const { app, hasConnection, isTrigger, selectedActionOrTrigger, substeps } =
    useStepMetadata(allApps, step)

  const handleSubmit = useCallback(
    (val: any) => {
      onUpdateStep(val as IStep)
    },
    [onUpdateStep],
  )

  const stepValidationSchema = useMemo(
    () => generateValidationSchema(substeps),
    [substeps],
  )

  // this ensures that we do not have an empty drawer
  if (!step.appKey && !step.key) {
    onDrawerClose()
  }

  if (!allApps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <>
      <Flex w="100%" flexDir="column">
        <StepExecutionsProvider priorExecutionSteps={priorExecutionSteps}>
          <Form
            key={step.id}
            defaultValues={step}
            onSubmit={handleSubmit}
            resolver={stepValidationSchema}
          >
            <Fragment>
              {/* Place ChooseConnectionSubstep outside the accordion structure */}
              {hasConnection && app && (
                <ChooseConnectionSubstep
                  step={step}
                  application={app}
                  onReconnect={onModalOpen}
                />
              )}

              {substeps?.map(
                (substep) =>
                  substep.key &&
                  // NOTE: webhook trigger is a special case where we want to show the step configuration immediately
                  ((step.appKey === 'webhook' && step?.webhookUrl) ||
                    ['chooseConnection', 'testStep'].includes(substep.key) ===
                      false) && (
                    <FlowSubstep
                      key={substep.key}
                      hasConnection={hasConnection}
                      isTrigger={isTrigger}
                      substep={substep}
                      step={step}
                      selectedActionOrTrigger={selectedActionOrTrigger}
                    />
                  ),
              )}
            </Fragment>
          </Form>
        </StepExecutionsProvider>
      </Flex>

      {isModalOpen && (
        <FlowStepConfigurationModal
          onClose={onModalClose}
          isTrigger={isTrigger}
          isLastStep={isLastStep}
          step={step}
          app={app}
          event={selectedActionOrTrigger}
        />
      )}
    </>
  )
}
