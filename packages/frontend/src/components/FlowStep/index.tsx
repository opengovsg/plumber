import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import * as React from 'react'
import { useLazyQuery, useQuery } from '@apollo/client'
import { yupResolver } from '@hookform/resolvers/yup'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AppIcon from 'components/AppIcon'
import ChooseAppAndEventSubstep from 'components/ChooseAppAndEventSubstep'
import ChooseConnectionSubstep from 'components/ChooseConnectionSubstep'
import FlowStepContextMenu from 'components/FlowStepContextMenu'
import FlowSubstep from 'components/FlowSubstep'
import Form from 'components/Form'
import TestSubstep from 'components/TestSubstep'
import { EditorContext } from 'contexts/Editor'
import { StepExecutionsProvider } from 'contexts/StepExecutions'
import { GET_APPS } from 'graphql/queries/get-apps'
import { GET_STEP_WITH_TEST_EXECUTIONS } from 'graphql/queries/get-step-with-test-executions'
import useFormatMessage from 'hooks/useFormatMessage'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'

import {
  AppIconStatusIconWrapper,
  AppIconWrapper,
  Content,
  Header,
  Wrapper,
} from './style'

type FlowStepProps = {
  collapsed?: boolean
  step: IStep
  index?: number
  onOpen?: () => void
  onClose?: () => void
  onChange: (step: IStep) => void
  onContinue?: () => void
}

const validIcon = <CheckCircleIcon color="success" />
const errorIcon = <ErrorIcon color="error" />

function generateValidationSchema(substeps: ISubstep[]) {
  const fieldValidations = substeps?.reduce(
    (allValidations, { arguments: args }) => {
      if (!args || !Array.isArray(args)) {
        return allValidations
      }

      const substepArgumentValidations: Record<string, BaseSchema> = {}

      for (const arg of args) {
        const { key, required, dependsOn } = arg

        // base validation for the field if not exists
        if (!substepArgumentValidations[key]) {
          substepArgumentValidations[key] = yup.mixed()
        }

        if (typeof substepArgumentValidations[key] === 'object') {
          // if the field is required, add the required validation
          if (required) {
            substepArgumentValidations[key] = substepArgumentValidations[
              key
            ].required(`${key} is required.`)
          }

          // if the field depends on another field, add the dependsOn required validation
          if (Array.isArray(dependsOn) && dependsOn.length > 0) {
            for (const dependsOnKey of dependsOn) {
              const missingDependencyValueMessage = `We're having trouble loading '${key}' data as required field '${dependsOnKey}' is missing.`

              // TODO: make `dependsOnKey` agnostic to the field. However, nested validation schema is not supported.
              // So the fields under the `parameters` key are subject to their siblings only and thus, `parameters.` is removed.
              substepArgumentValidations[key] = substepArgumentValidations[
                key
              ].when(`${dependsOnKey.replace('parameters.', '')}`, {
                is: (value: string) => Boolean(value) === false,
                then: (schema) =>
                  schema
                    .notOneOf([''], missingDependencyValueMessage)
                    .required(missingDependencyValueMessage),
              })
            }
          }
        }
      }

      return {
        ...allValidations,
        ...substepArgumentValidations,
      }
    },
    {},
  )

  const validationSchema = yup.object({
    parameters: yup.object(fieldValidations),
  })

  return yupResolver(validationSchema)
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { collapsed, onChange, onContinue } = props
  const editorContext = React.useContext(EditorContext)
  const contextButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const step: IStep = props.step
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)
  const isTrigger = step.type === 'trigger'
  const isAction = step.type === 'action'
  const formatMessage = useFormatMessage()
  const [currentSubstep, setCurrentSubstep] = React.useState<number | null>(0)
  const { data } = useQuery(GET_APPS, {
    variables: { onlyWithTriggers: isTrigger, onlyWithActions: isAction },
  })
  const [
    getStepWithTestExecutions,
    { data: stepWithTestExecutionsData, called: _stepWithTestExecutionsCalled },
  ] = useLazyQuery(GET_STEP_WITH_TEST_EXECUTIONS, {
    fetchPolicy: 'network-only',
  })

  React.useEffect(() => {
    if (!collapsed && !isTrigger) {
      getStepWithTestExecutions({
        variables: {
          stepId: step.id,
        },
      })
    }
  }, [collapsed, getStepWithTestExecutions, step.id, isTrigger])

  const apps: IApp[] = data?.getApps
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []

  const selectedActionOrTrigger = React.useMemo(
    () =>
      actionsOrTriggers.find(
        (actionOrTrigger: IAction | ITrigger) =>
          actionOrTrigger.key === step?.key,
      ),
    [actionsOrTriggers, step?.key],
  )
  const substeps = React.useMemo(
    () => selectedActionOrTrigger?.substeps || [],
    [selectedActionOrTrigger],
  )

  const handleChange = React.useCallback(({ step }: { step: IStep }) => {
    onChange(step)
  }, [])

  const expandNextStep = React.useCallback(() => {
    setCurrentSubstep((currentSubstep) => (currentSubstep ?? 0) + 1)
  }, [])

  const handleSubmit = (val: any) => {
    handleChange({ step: val as IStep })
  }

  const stepValidationSchema = React.useMemo(
    () => generateValidationSchema(substeps),
    [substeps],
  )

  if (!apps) {
    return <CircularProgress sx={{ display: 'block', my: 2 }} />
  }

  const onContextMenuClose = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    setAnchorEl(null)
  }
  const onContextMenuClick = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    setAnchorEl(contextButtonRef.current)
  }
  const onOpen = () => collapsed && props.onOpen?.()
  const onClose = () => props.onClose?.()

  const toggleSubstep = (substepIndex: number) =>
    setCurrentSubstep((value) => (value !== substepIndex ? substepIndex : null))

  const validationStatusIcon =
    step.status === 'completed' ? validIcon : errorIcon

  return (
    <Wrapper
      elevation={collapsed ? 1 : 4}
      onClick={onOpen}
      data-test="flow-step"
    >
      <Header collapsed={collapsed}>
        <Stack direction="row" alignItems="center" gap={2}>
          <AppIconWrapper>
            <AppIcon url={app?.iconUrl} name={app?.name} />

            <AppIconStatusIconWrapper>
              {validationStatusIcon}
            </AppIconStatusIconWrapper>
          </AppIconWrapper>

          <div>
            <Typography variant="caption">
              {isTrigger
                ? formatMessage('flowStep.triggerType')
                : formatMessage('flowStep.actionType')}
            </Typography>

            <Typography variant="body2">
              {step.position}. {app?.name}
            </Typography>
          </div>

          <Box display="flex" flex={1} justifyContent="end">
            {/* as there are no other actions besides "delete step", we hide the context menu. */}
            {!isTrigger && !editorContext.readOnly && (
              <IconButton
                color="primary"
                onClick={onContextMenuClick}
                ref={contextButtonRef}
              >
                <MoreHorizIcon />
              </IconButton>
            )}
          </Box>
        </Stack>
      </Header>

      <Collapse in={!collapsed} unmountOnExit>
        <Content>
          <List>
            <StepExecutionsProvider
              value={
                stepWithTestExecutionsData?.getStepWithTestExecutions as IStep[]
              }
            >
              <Form
                defaultValues={step}
                onSubmit={handleSubmit}
                resolver={stepValidationSchema}
              >
                <ChooseAppAndEventSubstep
                  expanded={currentSubstep === 0}
                  substep={{
                    key: 'chooAppAndEvent',
                    name: 'Choose app & event',
                    arguments: [],
                  }}
                  onExpand={() => toggleSubstep(0)}
                  onCollapse={() => toggleSubstep(0)}
                  onSubmit={expandNextStep}
                  onChange={handleChange}
                  step={step}
                />

                {substeps?.length > 0 &&
                  substeps.map((substep: ISubstep, index: number) => (
                    <React.Fragment key={`${substep?.name}-${index}`}>
                      {substep.key === 'chooseConnection' && app && (
                        <ChooseConnectionSubstep
                          expanded={currentSubstep === index + 1}
                          substep={substep}
                          onExpand={() => toggleSubstep(index + 1)}
                          onCollapse={() => toggleSubstep(index + 1)}
                          onSubmit={expandNextStep}
                          onChange={handleChange}
                          application={app}
                          step={step}
                          selectedActionOrTrigger={selectedActionOrTrigger}
                        />
                      )}

                      {substep.key === 'testStep' && (
                        <TestSubstep
                          expanded={currentSubstep === index + 1}
                          substep={substep}
                          onExpand={() => toggleSubstep(index + 1)}
                          onCollapse={() => toggleSubstep(index + 1)}
                          onSubmit={expandNextStep}
                          onChange={handleChange}
                          onContinue={onContinue}
                          step={step}
                          selectedActionOrTrigger={selectedActionOrTrigger}
                        />
                      )}

                      {substep.key &&
                        ['chooseConnection', 'testStep'].includes(
                          substep.key,
                        ) === false && (
                          <FlowSubstep
                            expanded={currentSubstep === index + 1}
                            substep={substep}
                            onExpand={() => toggleSubstep(index + 1)}
                            onCollapse={() => toggleSubstep(index + 1)}
                            onSubmit={expandNextStep}
                            onChange={handleChange}
                            step={step}
                          />
                        )}
                    </React.Fragment>
                  ))}
              </Form>
            </StepExecutionsProvider>
          </List>
        </Content>

        <Button fullWidth onClick={onClose}>
          Close
        </Button>
      </Collapse>

      {anchorEl && (
        <FlowStepContextMenu
          stepId={step.id}
          deletable={!isTrigger}
          onClose={onContextMenuClose}
          anchorEl={anchorEl}
        />
      )}
    </Wrapper>
  )
}
