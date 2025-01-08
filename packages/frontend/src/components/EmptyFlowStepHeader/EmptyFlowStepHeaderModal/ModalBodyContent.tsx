import type { IAction, IApp, ITrigger } from '@plumber/types'

import { useContext, useMemo, useState } from 'react'
import { BiArrowFromRight, BiChevronRight, BiSearch } from 'react-icons/bi'
import {
  Box,
  Flex,
  Icon,
  Image,
  InputGroup,
  InputLeftElement,
  Text,
} from '@chakra-ui/react'
import { Badge, Input } from '@opengovsg/design-system-react'
import { groupBy } from 'lodash'

import { getAppActionFlag, getAppFlag, getAppTriggerFlag } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
  useIsIfThenSelectable,
} from '@/helpers/toolbox'

const OTHERS_CATEGORY = 'Other'

interface ModalBodyContentProps {
  apps: IApp[]
  selectedApp: IApp | null
  setSelectedApp: (app: IApp | null) => void
  isTrigger: boolean
  isLastStep: boolean
  onSubmit: (appKey: string, actionKey: string) => void
}

export default function ModalBodyContent(
  props: ModalBodyContentProps,
): JSX.Element {
  const { apps, selectedApp, setSelectedApp, isTrigger, isLastStep, onSubmit } =
    props
  const launchDarkly = useContext(LaunchDarklyContext)
  const [_, isInitializingIfThen] = useIfThenInitializer()
  const isLoading = launchDarkly.isLoading || isInitializingIfThen

  const [searchQuery, setSearchQuery] = useState('')

  // Combine filtering and grouping logic into a single operation
  const groupedApps = useMemo(() => {
    const filteredApps = apps
      ?.filter((app) => {
        // Filter away apps hidden behind feature flags
        if (isLoading || !launchDarkly.flags || !app?.key) {
          return true
        }
        const ldAppFlag = getAppFlag(app.key)
        return launchDarkly.flags[ldAppFlag] ?? true
      })
      .filter((app) =>
        app.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )

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
  }, [apps, searchQuery, launchDarkly.flags, isLoading])

  const filteredTriggersOrActions = useMemo(() => {
    if (!selectedApp) {
      return []
    }

    const triggersOrActions: Array<ITrigger | IAction> = isTrigger
      ? selectedApp.triggers ?? []
      : selectedApp.actions ?? []
    return triggersOrActions?.filter((triggerOrAction: ITrigger | IAction) => {
      // Filter away triggers or actions hidden behind feature flags
      if (isLoading || !launchDarkly.flags || !selectedApp?.key) {
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

  const isIfThenSelectable = useIsIfThenSelectable({ isLastStep })

  /**
   * Returns second level modal view of triggers or actions: if an app has multiple
   * triggers or actions, it will be shown as a list of items
   */
  if (selectedApp) {
    return (
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
                    handleTriggerOrActionSelection(selectedApp, triggerOrAction)
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
    )
  }

  /**
   * Returns first level modal view of apps: if an app only has one trigger or action,
   * it will be shown as a single item. Else, it will be shown as an expandable item
   * to the next page
   */
  return (
    <Flex flexDir="column" gap={6}>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Icon as={BiSearch} color="base.content.medium" />
        </InputLeftElement>
        <Input
          placeholder="Search for apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          _focus={{
            borderColor: 'primary.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
          }}
        />
      </InputGroup>

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
                const triggersOrActions = isTrigger ? app.triggers : app.actions
                const singleTriggerOrAction =
                  triggersOrActions?.length === 1 ? triggersOrActions[0] : null

                return (
                  <Flex
                    key={app.key}
                    p={4}
                    borderWidth="1px"
                    borderColor="base.divider.medium"
                    borderRadius="lg"
                    onClick={() => {
                      if (singleTriggerOrAction) {
                        handleTriggerOrActionSelection(
                          app,
                          singleTriggerOrAction,
                        )
                      } else {
                        setSelectedApp(app)
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
                      boxShadow: '0 0 0 2px var(--chakra-colors-primary-500)',
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (singleTriggerOrAction) {
                          handleTriggerOrActionSelection(
                            app,
                            singleTriggerOrAction,
                          )
                        } else {
                          setSelectedApp(app)
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
                        <Text textStyle="body-2">
                          {singleTriggerOrAction
                            ? singleTriggerOrAction.description
                            : app.description}
                        </Text>
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
  )
}
