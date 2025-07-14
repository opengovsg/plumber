import { type IAction, IApp, ITrigger } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { Box, Flex, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import { ModalCloseButton } from '@opengovsg/design-system-react'

import { getAppActionFlag, getAppTriggerFlag } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

import BackButton from '../BackButton'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import FeedbackFooter from './FeedbackFooter'
import NewBadge from './NewBadge'

interface ChooseEventProps {
  onSelectAppEvent: (app: IApp, event: ITrigger | IAction) => void
}

export default function ChooseEvent(props: ChooseEventProps): JSX.Element {
  const { onSelectAppEvent } = props

  const launchDarkly = useContext(LaunchDarklyContext)

  const { modalState, isTrigger, patchModalState } = useContext(
    FlowStepConfigurationContext,
  )
  const { selectedApp } = modalState

  const isLoading = launchDarkly.isLoading

  const filteredTriggersOrActions = useMemo(() => {
    if (!selectedApp) {
      return []
    }

    const triggersOrActions: Array<ITrigger | IAction> = isTrigger
      ? selectedApp.triggers ?? []
      : selectedApp.actions ?? []
    return triggersOrActions?.filter((triggerOrAction: ITrigger | IAction) => {
      // Filter away triggers or actions hidden behind feature flags
      if (isLoading || !launchDarkly.flags || !selectedApp.key) {
        return true
      }
      const launchDarklyKey = isTrigger
        ? getAppTriggerFlag(selectedApp.key, triggerOrAction.key)
        : getAppActionFlag(selectedApp.key, triggerOrAction.key)
      return launchDarkly.flags[launchDarklyKey] ?? true
    })
  }, [selectedApp, isTrigger, launchDarkly.flags, isLoading])

  const onBack = useCallback(() => {
    patchModalState({
      selectedApp: null,
      selectedEvent: null,
      selectedConnectionId: '',
      currentScreen: 'choose-app',
    })
  }, [patchModalState])

  if (!selectedApp) {
    return <InvalidModalScreen />
  }

  return (
    <>
      <ModalHeader pt={0} mt={-4}>
        <Flex gap={2} flexDir="column" alignItems="flex-start">
          <BackButton onBack={onBack} />
          <Text textStyle="h3-semibold">{selectedApp.name}</Text>
          <Text textStyle="body-1">{selectedApp.description}</Text>
        </Flex>
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" colorScheme="secondary" />

      {/* Returns second level modal view of triggers or actions: if an app has multiple
       * triggers or actions, it will be shown as a list of items */}
      <ModalBody>
        <Flex flexDir="column" gap={3}>
          {filteredTriggersOrActions?.map(
            (triggerOrAction: ITrigger | IAction) => {
              return (
                <Box
                  key={triggerOrAction.key}
                  p={4}
                  borderWidth="1px"
                  borderRadius="lg"
                  onClick={() => onSelectAppEvent(selectedApp, triggerOrAction)}
                  opacity={1}
                  _hover={{
                    bg: 'interaction.muted.neutral.hover',
                    cursor: 'pointer',
                  }}
                  _active={{
                    bg: 'interaction.muted.neutral.active',
                  }}
                  _focus={{
                    outline: 'none',
                    boxShadow: '0 0 0 2px var(--chakra-colors-primary-500)',
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectAppEvent(selectedApp, triggerOrAction)
                    }
                  }}
                >
                  <Flex gap={2}>
                    <Text textStyle="subhead-1">{triggerOrAction.name}</Text>
                    {triggerOrAction?.isNew && <NewBadge />}
                  </Flex>
                  <Text textStyle="body-2">{triggerOrAction.description}</Text>
                </Box>
              )
            },
          )}
        </Flex>
      </ModalBody>
      <FeedbackFooter />
    </>
  )
}
