import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import * as React from 'react'
import { useQuery } from '@apollo/client'
import { FormControl } from '@chakra-ui/react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { FormLabel } from '@opengovsg/design-system-react'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import { EditorContext } from 'contexts/Editor'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { GET_APPS } from 'graphql/queries/get-apps'
import useFormatMessage from 'hooks/useFormatMessage'

type ChooseAppAndEventSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
}

const optionGenerator = (app: {
  name: string
  key: string
}): { label: string; value: string } => ({
  label: app.name as string,
  value: app.key as string,
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
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    step,
    onSubmit,
    onChange,
  } = props

  const launchDarkly = React.useContext(LaunchDarklyContext)

  const formatMessage = useFormatMessage()
  const editorContext = React.useContext(EditorContext)

  const isTrigger = step.type === 'trigger'
  const isAction = step.type === 'action'

  const { data } = useQuery(GET_APPS, {
    variables: { onlyWithTriggers: isTrigger, onlyWithActions: isAction },
  })
  const apps: IApp[] = data?.getApps
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

  const appOptions = React.useMemo(
    () => apps?.map((app) => optionGenerator(app)),
    [apps],
  )
  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []
  const actionOrTriggerOptions = React.useMemo(
    () =>
      actionsOrTriggers
        // Filter away stuff hidden behind feature flags
        .filter((actionOrTrigger) => {
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
        .map((trigger) => eventOptionGenerator(trigger)),
    [app?.key, launchDarkly],
  )
  const selectedActionOrTrigger = actionsOrTriggers.find(
    (actionOrTrigger: IAction | ITrigger) => actionOrTrigger.key === step?.key,
  )

  const isWebhook =
    isTrigger && (selectedActionOrTrigger as ITrigger)?.type === 'webhook'

  const { name } = substep

  const valid: boolean = !!step.key && !!step.appKey

  // placeholders
  const onEventChange = React.useCallback(
    (event: React.SyntheticEvent, selectedOption: unknown) => {
      if (typeof selectedOption === 'object') {
        // TODO: try to simplify type casting below.
        const typedSelectedOption = selectedOption as { value: string }
        const option: { value: string } = typedSelectedOption
        const eventKey = option?.value as string

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
    [step, onChange],
  )

  const onAppChange = React.useCallback(
    (event: React.SyntheticEvent, selectedOption: unknown) => {
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

  return (
    <React.Fragment>
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
            disabled={editorContext.readOnly}
            options={appOptions}
            renderInput={(params) => (
              <FormControl>
                <FormLabel isRequired>
                  {formatMessage('flowEditor.chooseApp')}
                </FormLabel>
                <TextField {...params} />
              </FormControl>
            )}
            value={getOption(appOptions, step.appKey)}
            onChange={onAppChange}
            data-test="choose-app-autocomplete"
          />

          {step.appKey && (
            <Box display="flex" width="100%" pt={2} flexDirection="column">
              <Autocomplete
                fullWidth
                disablePortal
                disableClearable
                disabled={editorContext.readOnly}
                options={launchDarkly.isLoading ? [] : actionOrTriggerOptions}
                loading={launchDarkly.isLoading}
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
                    <Typography>{option.label}</Typography>

                    {option.type === 'webhook' && (
                      <Chip
                        label={formatMessage('flowEditor.instantTriggerType')}
                        sx={{ mr: 3 }}
                      />
                    )}
                  </li>
                )}
                value={getOption(actionOrTriggerOptions, step.key)}
                onChange={onEventChange}
                data-test="choose-event-autocomplete"
              />
            </Box>
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
    </React.Fragment>
  )
}

export default ChooseAppAndEventSubstep
