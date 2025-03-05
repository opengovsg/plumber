import { type IAction, IApp, ITrigger } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { Box, Flex, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { getAppActionFlag, getAppTriggerFlag } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
  useIsIfThenSelectable,
} from '@/helpers/toolbox'

interface ChooseEventProps {
  selectedApp: IApp
  isTrigger: boolean
  isLastStep: boolean
  onSubmit: (appKey: string, actionKey: string) => void
  onBack: () => void
}

export default function ChooseEvent(props: ChooseEventProps): JSX.Element {
  const { selectedApp, isTrigger, isLastStep, onSubmit, onBack } = props

  const launchDarkly = useContext(LaunchDarklyContext)
  const [_, isInitializingIfThen] = useIfThenInitializer()
  const isLoading = launchDarkly.isLoading || isInitializingIfThen

  const isIfThenSelectable = useIsIfThenSelectable({ isLastStep })

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

  const handleTriggerOrActionSelection = async (
    app: IApp,
    triggerOrAction: ITrigger | IAction,
  ) => {
    onSubmit(app.key, triggerOrAction.key)
  }

  return (
    <>
      <ModalHeader>
        <Flex gap={2} flexDir="column" alignItems="flex-start">
          <Button
            variant="clear"
            onClick={onBack}
            leftIcon={<BiChevronLeft />}
            ml={-4}
          >
            Back
          </Button>
          <Text textStyle="h3-semibold">{selectedApp.name}</Text>
          <Text textStyle="body-1">{selectedApp.description}</Text>
        </Flex>
      </ModalHeader>

      {/* Returns second level modal view of triggers or actions: if an app has multiple
       * triggers or actions, it will be shown as a list of items */}
      <ModalBody>
        <Flex flexDir="column" gap={3}>
          {filteredTriggersOrActions?.map(
            (triggerOrAction: ITrigger | IAction) => {
              const isIfThen =
                selectedApp.key === TOOLBOX_APP_KEY &&
                triggerOrAction.key === TOOLBOX_ACTIONS.IfThen
              const isDisabled = isIfThen && !isIfThenSelectable

              return (
                <Box
                  key={triggerOrAction.key}
                  p={4}
                  borderWidth="1px"
                  borderRadius="lg"
                  onClick={() =>
                    !isDisabled &&
                    handleTriggerOrActionSelection(selectedApp, triggerOrAction)
                  }
                  opacity={isDisabled ? 0.5 : 1}
                  _hover={{
                    bg: 'interaction.muted.neutral.hover',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                  _active={{
                    bg: 'interaction.muted.neutral.active',
                  }}
                  _focus={{
                    outline: 'none',
                    boxShadow: isDisabled
                      ? 'none'
                      : '0 0 0 2px var(--chakra-colors-primary-500)',
                  }}
                  tabIndex={isDisabled ? -1 : 0} // Make focusable unless disabled
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTriggerOrActionSelection(
                        selectedApp,
                        triggerOrAction,
                      )
                    }
                  }}
                >
                  <Text textStyle="subhead-1">{triggerOrAction.name}</Text>
                  <Text textStyle="body-2">
                    {isDisabled
                      ? 'This can only be used in the last step'
                      : triggerOrAction.description}
                  </Text>
                </Box>
              )
            },
          )}
        </Flex>
      </ModalBody>
    </>
  )
}
