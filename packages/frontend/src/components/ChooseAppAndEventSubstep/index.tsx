import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { Box, Collapse, Flex, FormControl } from '@chakra-ui/react'
import { Button, FormLabel } from '@opengovsg/design-system-react'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import { ComboboxItem, SingleSelect } from 'components/SingleSelect'
import { getAppActionFlag, getAppFlag, getAppTriggerFlag } from 'config/flags'
import { EditorContext } from 'contexts/Editor'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { GET_APPS } from 'graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
  useIsIfThenSelectable,
} from 'helpers/toolbox'

type ChooseAppAndEventSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
  isLastStep: boolean
}

const formAppComboboxOption = (app: IApp): ComboboxItem => ({
  label: app.name as string,
  value: app.key as string,
  description: app?.description as string,
  isAppNew: !!app?.isNewApp,
})

const getSelectedOption = (
  options: ComboboxItem[],
  selectedOptionValue?: string,
): string => {
  const foundOption = options.find((option: ComboboxItem) => {
    if (typeof option !== 'string') {
      return option?.value === selectedOptionValue
    }
    return option === selectedOptionValue
  })
  if (typeof foundOption === 'string') {
    return foundOption
  }
  return foundOption?.value ?? ''
}

function ChooseAppAndEventSubstep(
  props: ChooseAppAndEventSubstepProps,
): React.ReactElement {
  const {
    step,
    isLastStep,
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    onSubmit,
    onChange,
  } = props

  const launchDarkly = useContext(LaunchDarklyContext)
  const editorContext = useContext(EditorContext)

  const isTrigger = step.type === 'trigger'

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  apps?.sort((a, b) => {
    if (a.isNewApp && b.isNewApp) {
      return a.name.localeCompare(b.name)
    }
    if (a.isNewApp) {
      return -1
    }
    if (b.isNewApp) {
      return 1
    }
    return a.name.localeCompare(b.name)
  })
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

  const appOptions = useMemo(
    () =>
      apps
        ?.filter((app) => {
          // Filter away stuff hidden behind feature flags
          if (!launchDarkly.flags || !app?.key) {
            return true
          }
          const ldAppFlag = getAppFlag(app.key)
          return launchDarkly.flags[ldAppFlag] ?? true
        })
        ?.map((app) => formAppComboboxOption(app)) ?? [],
    [apps, launchDarkly.flags],
  )

  const actionsOrTriggers: Array<ITrigger | IAction> = useMemo(
    () => (isTrigger ? app?.triggers : app?.actions) || [],
    [app?.actions, app?.triggers, isTrigger],
  )

  const isIfThenSelectable = useIsIfThenSelectable({ isLastStep })

  // event option generator
  const formEventComboboxOption = useCallback(
    (app: {
      name: string
      key: string
      description: string
      type?: string
    }): ComboboxItem => {
      //
      // ** EDGE CASE V2 **
      // Check if option should be disabled: The if-then edge case demon again!
      //
      // To prevent user confusion, we want to show If-Then as a disabled option
      // when we're not the last step.
      //
      const isDisabled =
        step.appKey === TOOLBOX_APP_KEY &&
        app.key === TOOLBOX_ACTIONS.IfThen &&
        !isIfThenSelectable

      return {
        label: app.name,
        value: app.key,
        description: isDisabled
          ? 'This can only be used in the last step'
          : app.description,
        type: app.type, // webhook or polling
        disabled: isDisabled,
      }
    },
    [step.appKey, isIfThenSelectable],
  )

  const actionOrTriggerOptions = useMemo(
    () =>
      actionsOrTriggers
        .filter((actionOrTrigger) => {
          // Filter away stuff hidden behind feature flags
          if (!launchDarkly.flags || !app?.key) {
            return true
          }
          const launchDarklyKey = isTrigger
            ? getAppTriggerFlag(app.key, actionOrTrigger.key)
            : getAppActionFlag(app.key, actionOrTrigger.key)
          return launchDarkly.flags[launchDarklyKey] ?? true
        })
        //
        .map((trigger) => formEventComboboxOption(trigger)),
    [
      actionsOrTriggers,
      app?.key,
      launchDarkly.flags,
      isTrigger,
      formEventComboboxOption,
    ],
  )

  const { name } = substep

  const valid: boolean = !!step.key && !!step.appKey

  //
  // Handle app or event changes
  //
  const [initializeIfThen, isInitializingIfThen] = useIfThenInitializer()
  const onEventChange = useCallback(
    async (eventKey: string) => {
      // ** EDGE CASE **
      // The if-then edge case demon here!
      //
      // If-then is weird in that we need to pre-populate with 2 branches
      // upon initial selection (the only action that spawns 2 steps upon
      // first selection), and we also need to update the first branch's
      // parameters.
      //
      // Since there are a bunch of edge cases for If-then in this component
      // already, let's localize the damage and continue adding edge cases
      // here.
      //
      // Note that we don't need to check for inequality to the current
      // step.key, since we don't display the action drop-down after someone
      // selects If-then.
      //
      if (app?.key === TOOLBOX_APP_KEY && eventKey === TOOLBOX_ACTIONS.IfThen) {
        await initializeIfThen(step)
        return
      }

      if (step.key !== eventKey) {
        onChange({
          step: {
            ...step,
            key: eventKey,
          },
        })
      }
    },
    [app?.key, step, onChange, initializeIfThen],
  )

  const onAppChange = useCallback(
    (appKey: string) => {
      if (step.appKey !== appKey) {
        onChange({
          step: {
            ...step,
            key: '',
            appKey,
            parameters: {},
          },
        })
      }
    },
    [step, onChange],
  )

  const onToggle = expanded ? onCollapse : onExpand

  const isLoading = launchDarkly.isLoading || isInitializingIfThen

  return (
    <>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={name}
        valid={valid}
      />

      <Collapse in={expanded} unmountOnExit>
        <Box w="100%" p="1rem 1rem 1.5rem">
          <Flex width="full" flexDir="column">
            <FormControl>
              <FormLabel isRequired>Choose an app</FormLabel>
              <Box>
                <SingleSelect
                  name="choose-app-option"
                  colorScheme="secondary"
                  isClearable={false}
                  isDisabled={isLoading || editorContext.readOnly}
                  // Don't display options until we can check feature flags!
                  items={isLoading ? [] : appOptions}
                  onChange={(selectedOption) => {
                    const option = getSelectedOption(appOptions, selectedOption)
                    onAppChange(option)
                  }}
                  value={getSelectedOption(appOptions, step.appKey)}
                  data-test="choose-app-autocomplete"
                />
              </Box>
            </FormControl>
          </Flex>

          {step.appKey && (
            <Flex width="full" pt={4} flexDir="column">
              <FormControl>
                <FormLabel isRequired>Choose an event</FormLabel>
                <Box>
                  <SingleSelect
                    name="choose-event-option"
                    colorScheme="secondary"
                    isClearable={false}
                    isDisabled={isLoading || editorContext.readOnly}
                    // Don't display options until we can check feature flags!
                    items={isLoading ? [] : actionOrTriggerOptions}
                    onChange={(selectedOption) => {
                      const option = getSelectedOption(
                        actionOrTriggerOptions,
                        selectedOption,
                      )
                      onEventChange(option)
                    }}
                    value={getSelectedOption(actionOrTriggerOptions, step.key)}
                    data-test="choose-event-autocomplete"
                  />
                </Box>
              </FormControl>
            </Flex>
          )}

          <Button
            isFullWidth
            onClick={onSubmit}
            mt={4}
            isDisabled={!valid || editorContext.readOnly}
            data-test="flow-substep-continue-button"
          >
            Continue
          </Button>
        </Box>
      </Collapse>
    </>
  )
}

export default ChooseAppAndEventSubstep
