import type { IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { Flex, useDisclosure } from '@chakra-ui/react'

import ChooseConnectionSubstep from '@/components/ChooseConnectionSubstep'
import FlowSubstep from '@/components/FlowSubstep'
import Form from '@/components/Form'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsProvider } from '@/contexts/StepExecutions'
import {
  generateValidationSchema,
  withDefaultParameters,
} from '@/helpers/editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

import LearnFromGuideInfobox from './LearnFromGuideInfobox'

type StepProps = {
  step: IStep
}

export default function Step(props: StepProps): React.ReactElement | null {
  const { step } = props

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const { onUpdateStep, resetTimestamp } = useContext(EditorContext)

  const { app, hasConnection, isTrigger, selectedActionOrTrigger, substeps } =
    useStepMetadata(step)

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

  const stepWithDefaultParameters = useMemo(
    () => withDefaultParameters(step, substeps),
    [step, substeps],
  )

  return (
    <>
      <Flex w="100%" flexDir="column">
        <StepExecutionsProvider currentStep={step}>
          <Form
            key={`${step.id}-${resetTimestamp}`}
            defaultValues={stepWithDefaultParameters}
            onSubmit={handleSubmit}
            resolver={stepValidationSchema}
          >
            <LearnFromGuideInfobox
              selectedActionOrTrigger={selectedActionOrTrigger}
            />
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
                  substep.key !== 'chooseConnection') && (
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
          </Form>
        </StepExecutionsProvider>
      </Flex>

      {isModalOpen && (
        <FlowStepConfigurationModal
          onClose={onModalClose}
          isTrigger={isTrigger}
          // this shouldnt matter here since it's just for reconnecting
          isLastStep={false}
          step={step}
          app={app}
          event={selectedActionOrTrigger}
        />
      )}
    </>
  )
}
