import type { IAction, IApp, ITrigger } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiArrowFromRight, BiChevronRight } from 'react-icons/bi'
import {
  Box,
  Flex,
  Icon,
  Image,
  ModalBody,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import { Badge, ModalCloseButton } from '@opengovsg/design-system-react'
import { groupBy } from 'lodash'

import { getAppActionFlag, getAppFlag } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
  useIsIfThenSelectable,
} from '@/helpers/toolbox'

import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'

import FeedbackFooter from './FeedbackFooter'
import ToolboxEvent from './ToolboxEvent'

const OTHERS_CATEGORY = 'Other'

interface ChooseAppProps {
  apps: IApp[]
  onSelectAppEvent: (app: IApp, triggerOrAction: ITrigger | IAction) => void
}

export default function ChooseApp(props: ChooseAppProps) {
  const { apps, onSelectAppEvent } = props
  const launchDarkly = useContext(LaunchDarklyContext)
  const { patchModalState, isTrigger, isLastStep } = useContext(
    FlowStepConfigurationContext,
  )

  const [_, isInitializingIfThen] = useIfThenInitializer()
  const isLoading = launchDarkly.isLoading || isInitializingIfThen

  const onSelectApp = useCallback(
    (app: IApp) => {
      patchModalState({
        selectedApp: app,
        currentScreen: 'choose-event',
      })
    },
    [patchModalState],
  )

  const isIfThenSelectable = useIsIfThenSelectable({ isLastStep })
  const filteredToolboxActions = useMemo(() => {
    if (isLoading || !launchDarkly.flags) {
      return []
    }

    const ldToolboxAppFlag = getAppFlag(TOOLBOX_APP_KEY)
    if (!launchDarkly.flags[ldToolboxAppFlag]) {
      return []
    }

    const toolboxActions =
      apps?.find((app) => app.key === TOOLBOX_APP_KEY)?.actions ?? []
    return toolboxActions.filter((action) => {
      // Filter away actions hidden behind feature flags
      if (isLoading || !launchDarkly.flags) {
        return true
      }

      const ldToolboxActionFlag = getAppActionFlag(TOOLBOX_APP_KEY, action.key)
      return launchDarkly.flags[ldToolboxActionFlag] ?? true
    })
  }, [apps, isLoading, launchDarkly.flags])

  // Combine filtering and grouping logic into a single operation
  const groupedApps = useMemo(() => {
    const filteredApps = apps?.filter((app) => {
      // Filter away apps hidden behind feature flags
      if (isLoading || !launchDarkly.flags || !app?.key) {
        return true
      }
      const ldAppFlag = getAppFlag(app.key)
      return launchDarkly.flags[ldAppFlag] ?? true
    })

    // Group the filtered apps
    const grouped = groupBy(
      filteredApps,
      (app) => app.category || OTHERS_CATEGORY,
    )

    // Sort categories alphabetically, with 'Other' at the end for trigger apps specifically
    return Object.entries(grouped).sort((a, b) => {
      if (a[0] === OTHERS_CATEGORY) {
        return 1
      }
      if (b[0] === OTHERS_CATEGORY) {
        return -1
      }
      return a[0].localeCompare(b[0])
    })
  }, [apps, launchDarkly.flags, isLoading])

  return (
    <>
      <ModalHeader pt={0}>
        <Flex gap={2} flexDir="column" alignItems="flex-start">
          <Text textStyle="h3-semibold">
            {isTrigger
              ? 'Choose how you want your workflow to start'
              : 'Add a step'}
          </Text>
          {!isTrigger && (
            <Text textStyle="body-1">
              These are actions that you can add to your workflow.
            </Text>
          )}
        </Flex>
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" />

      {/* Returns first level modal view of apps: if an app only has one trigger or action,
       * it will be shown as a single item. Else, it will be shown as an expandable item
       * to the next page */}
      <ModalBody
        // Reference: https://css-tricks.com/books/greatest-css-tricks/scroll-shadows/
        sx={{
          background: `
            /* Shadow Cover TOP */
            linear-gradient(white 30%, rgba(255, 255, 255, 0)) center top,

            /* Shadow Cover BOTTOM */
            linear-gradient(rgba(255, 255, 255, 0), white 70%) center bottom,

            /* Shadow TOP */
            radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0)) center top,

            /* Shadow BOTTOM */
            radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0)) center bottom
          `,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 40px, 100% 40px, 100% 14px, 100% 14px',
          backgroundAttachment: 'local, local, scroll, scroll',
        }}
      >
        <Flex flexDir="column" gap={6}>
          {groupedApps && groupedApps.length === 0 ? (
            <Flex
              justifyContent="center"
              alignItems="center"
              py={8}
              color="base.content.medium"
            >
              No apps found
            </Flex>
          ) : (
            groupedApps.map(([category, apps]) => (
              <Box key={category}>
                {category !== OTHERS_CATEGORY && (
                  <Text textStyle="caption-3" mb={3}>
                    {category}
                  </Text>
                )}

                <Flex flexDir="column" gap={3}>
                  {apps.map((app) => {
                    // For toolbox app specifically, show all the toolbox actions
                    if (app.key === TOOLBOX_APP_KEY) {
                      return filteredToolboxActions.map((action) => (
                        <ToolboxEvent
                          key={action.key}
                          action={action}
                          onSelectAppEvent={() => onSelectAppEvent(app, action)}
                          isDisabled={
                            action.key === TOOLBOX_ACTIONS.IfThen &&
                            !isIfThenSelectable
                          }
                        />
                      ))
                    }

                    const triggersOrActions = isTrigger
                      ? app.triggers
                      : app.actions
                    const singleTriggerOrAction =
                      triggersOrActions?.length === 1
                        ? triggersOrActions[0]
                        : null

                    return (
                      <Flex
                        key={app.key}
                        p={4}
                        borderWidth="1px"
                        borderColor="base.divider.medium"
                        borderRadius="lg"
                        onClick={() => {
                          if (singleTriggerOrAction) {
                            onSelectAppEvent(app, singleTriggerOrAction)
                          } else {
                            onSelectApp(app)
                          }
                        }}
                        justifyContent="space-between"
                        alignItems="center"
                        _hover={{
                          bg: 'interaction.muted.neutral.hover',
                          cursor: 'pointer',
                        }}
                        _active={{
                          bg: 'interaction.muted.neutral.active',
                        }}
                        _focus={{
                          outline: 'none',
                          boxShadow:
                            '0 0 0 2px var(--chakra-colors-primary-500)',
                        }}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (singleTriggerOrAction) {
                              onSelectAppEvent(app, singleTriggerOrAction)
                            } else {
                              onSelectApp(app)
                            }
                          }
                        }}
                      >
                        <Flex alignItems="center" gap={4}>
                          <Image
                            src={app.iconUrl}
                            boxSize={8}
                            borderStyle="solid"
                            fit="contain"
                            fallback={
                              <Icon
                                boxSize={6}
                                as={BiArrowFromRight}
                                color="base.content.default"
                              />
                            }
                          />

                          <Flex flexDir="column" gap={1}>
                            <Flex gap={2}>
                              <Text textStyle="subhead-1">{app.name}</Text>
                              {app.isNewApp && (
                                <Badge
                                  bgColor="interaction.muted.main.active"
                                  color="primary.500"
                                >
                                  New
                                </Badge>
                              )}
                            </Flex>
                            <Text textStyle="body-2">{app.description}</Text>
                          </Flex>
                        </Flex>

                        {triggersOrActions && triggersOrActions?.length > 1 && (
                          <Icon as={BiChevronRight} />
                        )}
                      </Flex>
                    )
                  })}
                </Flex>
              </Box>
            ))
          )}
        </Flex>
      </ModalBody>
      <FeedbackFooter />
    </>
  )
}
