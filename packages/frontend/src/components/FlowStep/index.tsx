import type { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { matchParamsToDataIn } from '../FlowStepTestController/utils'

import StepAppIcon from './components/StepAppIcon'
import StepCaptionAndDemo from './components/StepCaptionAndDemo'
import StepDeleteButton from './components/StepDeleteButton'
import TestAgainInfobox from './components/TestAgainInfobox'
import FlowStepWrapper from './FlowStepWrapper'
import { flowStepStyles } from './styles'

type FlowStepProps = {
  step: IStep
  isDeletable?: boolean
  isLastStep: boolean
  isNested?: boolean
  onOpen: () => void
  onClose: () => void
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { step, isLastStep, isNested, onOpen, onClose } = props

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const {
    allApps,
    currentStepId,
    isDrawerOpen,
    isMobile,
    readOnly,
    testExecutionSteps,
    varInfoMap,
  } = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]
  const { app, caption, isCompleted, isTrigger, selectedActionOrTrigger } =
    useStepMetadata(allApps, step)

  const isDeletable =
    displayOverrides?.disableDelete === true
      ? false
      : !readOnly && props.isDeletable

  const { shouldTestStepAgain, isTestSuccessful } = useMemo(() => {
    const testResult = testExecutionSteps.find((ts) => ts.stepId === step.id)
    if (!testResult) {
      return {
        shouldTestStepAgain: false,
        isTestSuccessful: testResult,
      }
    }
    return {
      shouldTestStepAgain: !matchParamsToDataIn(
        testResult?.dataIn,
        step.parameters,
        varInfoMap,
      ),
      isTestSuccessful: testResult.status === 'success',
    }
  }, [testExecutionSteps, step, varInfoMap])

  const shouldHighlight = currentStepId === step.id

  const handleClick = useCallback(() => {
    if (!app) {
      onModalOpen()
      return
    }
    if (isDrawerOpen && currentStepId === step.id) {
      onClose()
    } else {
      onOpen()
    }
  }, [app, isDrawerOpen, currentStepId, step.id, onModalOpen, onClose, onOpen])

  if (!allApps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <FlowStepWrapper>
      {shouldTestStepAgain && (
        <TestAgainInfobox
          isNested={isNested}
          shouldHighlight={shouldHighlight}
        />
      )}
      <Flex
        {...flowStepStyles.container}
        borderTopWidth={shouldTestStepAgain ? 0 : '1px'}
        borderColor={
          shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
        }
        borderTopRadius={shouldTestStepAgain ? 'none' : 'lg'}
        w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
      >
        <Flex
          {...flowStepStyles.topHeader}
          py={isNested ? 2 : 4}
          onClick={handleClick}
        >
          <StepAppIcon
            isCompleted={isCompleted}
            isNested={isNested}
            isTestSuccessful={isTestSuccessful}
            shouldTestStepAgain={shouldTestStepAgain}
            app={app}
          />
          <StepCaptionAndDemo app={app} caption={caption} />
          {isDeletable && (
            <StepDeleteButton
              isNested={isNested}
              onClose={onClose}
              step={step}
            />
          )}
        </Flex>
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
    </FlowStepWrapper>
  )
}
