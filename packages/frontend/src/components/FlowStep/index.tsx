import type { IAction, IStep, ITrigger } from '@plumber/types'

import { type MouseEventHandler, useCallback, useContext, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Flex, useDisclosure } from '@chakra-ui/react'

import FlowStepHeader from '@/components/FlowStepHeader'
import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

type FlowStepProps = {
  collapsed?: boolean
  step: IStep
  isDeletable?: boolean
  isLastStep: boolean
  isNested?: boolean
  index?: number
  onOpen: () => void
  onClose: () => void
  onChange: (step: IStep) => void
  shouldHighlight?: boolean
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { step, collapsed, isLastStep, onOpen, onClose } = props

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
    setCurrentStepId,
    setCurrentStepIndex,
  } = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]
  const { app, caption, isTrigger } = useStepMetadata(allApps, step)

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

  const isDeletable =
    displayOverrides?.disableDelete === true ? false : !readOnly
  const [deleteStep, { loading: isDeletingStep }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
    fetchPolicy: 'no-cache', // intentionally re-fetch the pipe to ensure the step is removed
  })
  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { ids: [step.id] } } })
      // NOTE: this ensures that the drawer is closed and step headers
      // return to the original width when the drawer is closed
      onClose()
      setCurrentStepId(null)
      setCurrentStepIndex(null)
    },
    [deleteStep, step.id, onClose, setCurrentStepId, setCurrentStepIndex],
  )

  const shouldHighlight = currentStepId === step.id

  return (
    <>
      <Flex
        alignItems="center"
        display={isMobile ? 'block' : 'flex'}
        flexDir="column"
        w="100%"
      >
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
            isDrawerOpen={isDrawerOpen}
            onDelete={isDeletable ? onDelete : undefined}
            isDeleting={isDeletable ? isDeletingStep : undefined}
            onOpen={onOpen}
            onClose={onClose}
            collapsed={collapsed ?? true}
            demoVideoUrl={app?.demoVideoDetails?.url}
            demoVideoTitle={app?.demoVideoDetails?.title}
            shouldHighlight={shouldHighlight}
          />
        )}
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
