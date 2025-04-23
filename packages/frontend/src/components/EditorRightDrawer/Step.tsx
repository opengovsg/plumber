import type { IFlowTemplateConfig, IStep, ISubstep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import ChooseConnectionSubstep from '@/components/ChooseConnectionSubstep'
import FlowSubstep from '@/components/FlowSubstep'
import Form from '@/components/Form'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsProvider } from '@/contexts/StepExecutions'
import { StepExecutionsToIncludeContext } from '@/contexts/StepExecutionsToInclude'
import { generateValidationSchema } from '@/helpers/editor'
import { replacePlaceholdersForHelpMessage } from '@/helpers/flow-templates'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

type StepProps = {
  step: IStep
  isLastStep: boolean
  index?: number | null
  onClose: () => void
  onContinue?: () => void
  onOpen: () => void
  templateConfig?: IFlowTemplateConfig
}

export default function Step(props: StepProps): React.ReactElement | null {
  const { step, isLastStep, templateConfig } = props

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

  const { app, isTrigger, selectedActionOrTrigger, substeps } = useStepMetadata(
    allApps,
    step,
  )

  const handleSubmit = async (val: any) => {
    await onUpdateStep(val as IStep)
  }

  const stepValidationSchema = useMemo(
    () => generateValidationSchema(substeps),
    [substeps],
  )

  // generate help message only if template config exists
  const stepAppEventKey = `${step?.appKey}_${step?.key}`
  const templateStepAppEventKey = step.config.templateConfig?.appEventKey
  const templateStepHelpMessage = replacePlaceholdersForHelpMessage(
    templateStepAppEventKey,
    templateConfig,
  )

  // Only show if the template step app key matches the current step app key
  // and has a help message (once tested successfully, the template step app key is removed)
  const shouldShowInfobox: boolean =
    stepAppEventKey === templateStepAppEventKey && !!templateStepHelpMessage

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
        {shouldShowInfobox && (
          <Box boxShadow="sm" borderRadius="lg">
            <Infobox
              icon={<BiInfoCircle />}
              variant="secondary"
              style={{
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0',
              }}
            >
              <MarkdownRenderer
                source={templateStepHelpMessage}
                components={infoboxMdComponents}
              />
            </Infobox>
          </Box>
        )}

        <StepExecutionsProvider priorExecutionSteps={priorExecutionSteps}>
          <Form
            key={step.id}
            defaultValues={step}
            onSubmit={handleSubmit}
            resolver={stepValidationSchema}
          >
            <Fragment>
              {/* Place ChooseConnectionSubstep outside the accordion structure */}
              {substeps?.some(
                (substep: ISubstep) => substep.key === 'chooseConnection',
              ) &&
                app && (
                  <ChooseConnectionSubstep
                    step={step}
                    application={app}
                    onReconnect={onModalOpen}
                  />
                )}

              {substeps?.map(
                (substep) =>
                  substep.key &&
                  ((step.appKey === 'webhook' && step?.webhookUrl) ||
                    ['chooseConnection', 'testStep'].includes(substep.key) ===
                      false) && (
                    <FlowSubstep
                      key={substep.key}
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
