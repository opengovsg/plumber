import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { type SyntheticEvent, useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { Flex, FormControl, Text } from '@chakra-ui/react'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'
import { Badge, FormLabel } from '@opengovsg/design-system-react'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import { EditorContext } from 'contexts/Editor'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { GET_APPS } from 'graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
  useIsIfThenSelectable,
} from 'helpers/toolbox'
import useFormatMessage from 'hooks/useFormatMessage'

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

const optionGenerator = (app: {
  name: string
  key: string
  description?: string
}): { label: string; value: string; description: string } => ({
  label: app.name as string,
  value: app.key as string,
  description: app?.description as string,
})

const eventOptionGenerator = (app: {
  name: string
  key: string
  type?: string
}): { label: string; value: string; type: string } => ({
  label: app.name as string,
  value: app.key as string,
  type: app?.type as string,
})

const getOption = <T extends { value: string }>(
  options: T[],
  selectedOptionValue?: string,
) => options.find((option) => option.value === selectedOptionValue)

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

  const formatMessage = useFormatMessage()
  const editorContext = useContext(EditorContext)

  const isTrigger = step.type === 'trigger'

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  apps?.sort((a, b) => {
    if (a.description) {
      return -1
    }
    return a.name.localeCompare(b.name)
  })
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

  const isIfThenSelectable = useIsIfThenSelectable(isLastStep)
  const appOptions = useMemo(
    () =>
      apps
        ?.filter((app) => {
          //
          // ** EDGE CASE **
          //
          // We want to hide If-Then in some cases (see useIsIfThenSelectable
          // comments).
          //
          // We edge case since a generic implementation adds too much
          // complexity; we'll move to generic if there's another use case for
          // such hiding.
          //
          // If everyone forgets about this, it's OK because the next guy to
          // add a new toolbox action will get confused why toolbox is missing
          // ... and find this.
          //
          if (app.key === TOOLBOX_APP_KEY && !isIfThenSelectable) {
            return false
          }

          // Filter away stuff hidden behind feature flags
          if (!launchDarkly.flags || !app?.key) {
            return true
          }
          const launchDarklyKey = ['app', app.key].join('_')
          return launchDarkly.flags[launchDarklyKey] ?? true
        })
        ?.map((app) => optionGenerator(app)) ?? [],
    [apps, step.position, isIfThenSelectable, launchDarkly.flags],
  )

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []
  const actionOrTriggerOptions = useMemo(
    () =>
      actionsOrTriggers
        .filter((actionOrTrigger) => {
          //
          // ** EDGE CASE AGAIN **
          //
          // Hello, the if-then edge case demon here again!
          //
          // To ensure if-then is always the last step, we also need to guard
          // against users selecting toolbox first, then adding steps after the
          // toolbox step, then selecting If-Then in the toolbox step.
          //
          // Luckily, we can remove the top app-hiding edge case once we
          // implement for-each, and toolbox will have multiple actions.
          //
          if (
            app?.key === TOOLBOX_APP_KEY &&
            actionOrTrigger?.key === TOOLBOX_ACTIONS.IfThen &&
            !isIfThenSelectable
          ) {
            return false
          }

          // Filter away stuff hidden behind feature flags
          if (!launchDarkly.flags || !app?.key) {
            return true
          }
          const launchDarklyKey = [
            'app',
            app.key,
            isTrigger ? 'trigger' : 'action',
            actionOrTrigger.key,
          ].join('_')
          return launchDarkly.flags[launchDarklyKey] ?? true
        })
        //
        .map((trigger) => eventOptionGenerator(trigger)),
    [app?.key, launchDarkly.flags, isIfThenSelectable, step],
  )
  const selectedActionOrTrigger = actionsOrTriggers.find(
    (actionOrTrigger: IAction | ITrigger) => actionOrTrigger.key === step?.key,
  )

  const isWebhook =
    isTrigger && (selectedActionOrTrigger as ITrigger)?.type === 'webhook'

  const { name } = substep

  const valid: boolean = !!step.key && !!step.appKey

  //
  // Handle app or event changes
  //
  const [initializeIfThen, isInitializingIfThen] = useIfThenInitializer()
  const onEventChange = useCallback(
    async (_event: SyntheticEvent, selectedOption: unknown) => {
      if (typeof selectedOption === 'object') {
        // TODO: try to simplify type casting below.
        const typedSelectedOption = selectedOption as { value: string }
        const option: { value: string } = typedSelectedOption
        const eventKey = option?.value as string

        //
        // ** EDGE CASE AGAIN V2 **
        //
        // Hello, the if-then edge case demon here again and again!
        //
        // If-then is weird in that we need to pre-populate with 2 branches
        // upon initial selection (the only action that spawns 2 steps upon
        // first selection), and we also need to update the first branch's
        // parameters.
        //
        // Since there are a bunch of edge cases for If-Then in this component
        // already, let's localize the damage and continue adding edge cases
        // here.
        //
        // Note that we don't need to check for inequality to the current
        // step.key, since we don't display the action drop-down after someone
        // selects If-Then.
        //
        if (
          app?.key === TOOLBOX_APP_KEY &&
          eventKey === TOOLBOX_ACTIONS.IfThen
        ) {
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
      }
    },
    [app?.key, step, onChange, initializeIfThen],
  )

  const onAppChange = useCallback(
    (_event: SyntheticEvent, selectedOption: unknown) => {
      if (typeof selectedOption === 'object') {
        // TODO: try to simplify type casting below.
        const typedSelectedOption = selectedOption as { value: string }
        const option: { value: string } = typedSelectedOption
        const appKey = option?.value as string

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

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <ListItem
          sx={{
            pt: 2,
            pb: 3,
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Autocomplete
            fullWidth
            disablePortal
            disableClearable
            disabled={isLoading || editorContext.readOnly}
            loading={isLoading}
            // Don't display options until we can check feature flags!
            options={launchDarkly.isLoading ? [] : appOptions}
            renderOption={(optionProps, option) => (
              <li
                {...optionProps}
                key={option.value.toString()}
                style={{
                  flexDirection: 'row',
                }}
              >
                <Flex flexDir="column">
                  <Flex gap={2} alignItems="center">
                    <Text>{option.label}</Text>
                    {option.description && (
                      <Badge
                        bgColor="interaction.muted.main.active"
                        color="primary.600"
                        px={2}
                        py={1}
                      >
                        New
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="xs">{option.description}</Text>
                </Flex>
              </li>
            )}
            renderInput={(params) => (
              <FormControl>
                <FormLabel isRequired>
                  {formatMessage('flowEditor.chooseApp')}
                </FormLabel>
                <TextField {...params} />
              </FormControl>
            )}
            value={
              getOption(appOptions, step.appKey) ?? {
                label: '',
                value: '',
                description: '',
              }
            }
            onChange={onAppChange}
            data-test="choose-app-autocomplete"
          />

          {step.appKey && (
            <Flex width="full" pt={4} flexDir="column">
              <Autocomplete
                fullWidth
                disablePortal
                disableClearable
                disabled={isLoading || editorContext.readOnly}
                loading={isLoading}
                // Don't display options until we can check feature flags!
                options={isLoading ? [] : actionOrTriggerOptions}
                renderInput={(params) => (
                  <FormControl>
                    <FormLabel isRequired>
                      {formatMessage('flowEditor.chooseEvent')}
                    </FormLabel>
                    <TextField
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {isWebhook && (
                              <Chip
                                label={formatMessage(
                                  'flowEditor.instantTriggerType',
                                )}
                              />
                            )}

                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  </FormControl>
                )}
                renderOption={(optionProps, option) => (
                  <li
                    {...optionProps}
                    key={option.value.toString()}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text>{option.label}</Text>

                    {option.type === 'webhook' && (
                      <Chip
                        label={formatMessage('flowEditor.instantTriggerType')}
                        sx={{ mr: 3 }}
                      />
                    )}
                  </li>
                )}
                value={
                  getOption(actionOrTriggerOptions, step.key) ?? {
                    label: '',
                    value: '',
                    type: '',
                  }
                }
                onChange={onEventChange}
                data-test="choose-event-autocomplete"
              />
            </Flex>
          )}

          {isTrigger && (selectedActionOrTrigger as ITrigger)?.pollInterval && (
            <TextField
              label={formatMessage('flowEditor.pollIntervalLabel')}
              value={formatMessage('flowEditor.pollIntervalValue', {
                minutes: (selectedActionOrTrigger as ITrigger)?.pollInterval,
              })}
              sx={{ mt: 2 }}
              fullWidth
              disabled
            />
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={onSubmit}
            sx={{ mt: 2 }}
            disabled={!valid || editorContext.readOnly}
            data-test="flow-substep-continue-button"
          >
            Continue
          </Button>
        </ListItem>
      </Collapse>
    </>
  )
}

export default ChooseAppAndEventSubstep
