import type {
  IAction,
  IFlowTemplateConfig,
  IStep,
  ITrigger,
} from '@plumber/types'

import {
  type MouseEventHandler,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import FlowStepHeader from '@/components/FlowStepHeader'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { replacePlaceholdersForHelpMessage } from '@/helpers/flow-templates'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

type FlowStepProps = {
  collapsed?: boolean
  step: IStep
  isLastStep: boolean
  index?: number
  onOpen: () => void
  onClose: () => void
  onChange: (step: IStep) => void
  onContinue?: () => void
  templateConfig?: IFlowTemplateConfig
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { step, collapsed, isLastStep, onOpen, onClose, templateConfig } = props
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const { readOnly } = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]
  const { app, apps, caption, isTrigger } = useStepMetadata(step)

  const actionsOrTriggers: Array<ITrigger | IAction> = useMemo(
    () => (isTrigger ? app?.triggers : app?.actions) || [],
    [app?.actions, app?.triggers, isTrigger],
  )

  const selectedActionOrTrigger = useMemo(
    () =>
      actionsOrTriggers.find(
        (actionOrTrigger: IAction | ITrigger) =>
          actionOrTrigger.key === step?.key,
      ),
    [actionsOrTriggers, step?.key],
  )

  // const cannotChooseApp = displayOverrides?.disableActionChanges ?? false
  // const [currentSubstep, setCurrentSubstep] = useState<number | null>(
  //   // OK to set to 1, even if a step has _no_ substeps, everything will just be
  //   // collapsed due to matching logic below.
  //   cannotChooseApp ? 1 : 0,
  // )

  const isDeletable =
    displayOverrides?.disableDelete === true ? false : !readOnly
  const [deleteStep, { loading: isDeletingStep }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { ids: [step.id] } } })
      // setCurrentSubstep(0)
    },
    [deleteStep, step.id],
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

  if (!apps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <>
      <Flex w="100%" flexDir="column">
        {shouldShowInfobox && (
          <Box boxShadow={collapsed ? undefined : 'sm'} borderRadius="lg">
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

        {!app || !selectedActionOrTrigger ? (
          <EmptyFlowStepHeader
            isTrigger={isTrigger}
            onModalOpen={onModalOpen}
          />
        ) : (
          <FlowStepHeader
            iconUrl={app?.iconUrl}
            caption={displayOverrides?.caption ?? caption}
            hintAboveCaption={
              displayOverrides?.hintAboveCaption ??
              (isTrigger ? 'When' : 'Then')
            }
            isCompleted={step.status === 'completed'}
            onDelete={isDeletable ? onDelete : undefined}
            isDeleting={isDeletable ? isDeletingStep : undefined}
            onOpen={onOpen}
            onClose={onClose}
            collapsed={collapsed ?? true}
            demoVideoUrl={app?.demoVideoDetails?.url}
            demoVideoTitle={app?.demoVideoDetails?.title}
            isInfoboxPresent={shouldShowInfobox}
          >
            {null}
          </FlowStepHeader>
        )}
      </Flex>

      {isModalOpen && (
        <FlowStepConfigurationModal
          onClose={() => {
            onModalClose()
            onOpen() // to open the flowstep upon updating of the step
          }}
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
