import type { IFlowTemplateConfig, IStep, ISubstep } from '@plumber/types'

import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import { Infobox } from '@opengovsg/design-system-react'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'
import type { ObjectShape } from 'yup/lib/object'

import ChooseConnectionSubstep from '@/components/ChooseConnectionSubstep'
import FlowSubstep from '@/components/FlowSubstep'
import Form from '@/components/Form'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import TestSubstep from '@/components/TestSubstep'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsProvider } from '@/contexts/StepExecutions'
import { StepExecutionsToIncludeContext } from '@/contexts/StepExecutionsToInclude'
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

// FIXME (ogp-weeloong): remove this; not needed since we already do validation in FlowSubstep.
function generateValidationSchema(substeps: ISubstep[]) {
  const fieldValidations = substeps?.reduce(
    (allValidations, { arguments: args }) => {
      if (!args || !Array.isArray(args)) {
        return allValidations
      }

      const substepArgumentValidations: Record<string, BaseSchema> = {}

      for (const arg of args) {
        const { key, required, hiddenIf } = arg

        // base validation for the field if not exists
        if (!substepArgumentValidations[key]) {
          substepArgumentValidations[key] = yup.mixed()
        }

        if (typeof substepArgumentValidations[key] === 'object') {
          // if the field is required and not conditionally hidden, add the
          // required validation
          if (required && !hiddenIf) {
            substepArgumentValidations[key] = substepArgumentValidations[
              key
            ].required(`${key} is required.`)
          }
        }
      }

      return {
        ...allValidations,
        ...substepArgumentValidations,
      }
    },
    {} as ObjectShape,
  )

  const validationSchema = yup.object({
    parameters: yup.object(fieldValidations),
  })

  return yupResolver(validationSchema)
}

export default function Step(props: StepProps): React.ReactElement | null {
  const { index, step, isLastStep, onContinue, templateConfig } = props

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const { onDrawerClose, onUpdateStep, testExecutionSteps } =
    useContext(EditorContext)

  const [currentSubstep, setCurrentSubstep] = useState<number | null>(0)

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

  const { app, apps, isTrigger, selectedActionOrTrigger, substeps } =
    useStepMetadata(step)

  const handleSubmit = async (val: any) => {
    await onUpdateStep(val as IStep)
  }

  const expandNextStep = useCallback(() => {
    setCurrentSubstep((currentSubstep) => (currentSubstep ?? 0) + 1)
  }, [])

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

  const toggleSubstep = (substepIndex: number) =>
    setCurrentSubstep((value) => (value !== substepIndex ? substepIndex : null))

  useEffect(() => {
    if (index !== null) {
      setCurrentSubstep(0)
    }
  }, [index])

  // this ensures that we do not have an empty drawer
  if (!step.appKey && !step.key) {
    onDrawerClose()
  }

  if (!apps) {
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

            {/* Render the remaining substeps as accordions */}
            {substeps?.length > 0 &&
              substeps
                .filter((substep) => substep.key !== 'chooseConnection')
                .map((substep: ISubstep, index: number) => {
                  return (
                    <Fragment key={`${substep?.name}-${index}`}>
                      {substep.key === 'testStep' && (
                        <TestSubstep
                          expanded={currentSubstep === index}
                          substep={substep}
                          onExpand={() => toggleSubstep(index)}
                          onCollapse={() => toggleSubstep(index)}
                          onChange={handleSubmit}
                          onContinue={onContinue}
                          step={step}
                          selectedActionOrTrigger={selectedActionOrTrigger}
                        />
                      )}

                      {substep.key && substep.key !== 'testStep' && (
                        <FlowSubstep
                          expanded={currentSubstep === index}
                          substep={substep}
                          onExpand={() => toggleSubstep(index)}
                          onCollapse={() => toggleSubstep(index)}
                          onSubmit={expandNextStep}
                          onChange={handleSubmit}
                          step={step}
                          settingsLabel={
                            selectedActionOrTrigger?.settingsStepLabel ??
                            app?.substepLabels?.settingsStepLabel
                          }
                          selectedActionOrTrigger={selectedActionOrTrigger}
                        />
                      )}
                    </Fragment>
                  )
                })}
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
