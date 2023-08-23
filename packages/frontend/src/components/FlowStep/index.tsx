import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLazyQuery, useQuery } from '@apollo/client'
import { CircularProgress } from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import ChooseAppAndEventSubstep from 'components/ChooseAppAndEventSubstep'
import ChooseConnectionSubstep from 'components/ChooseConnectionSubstep'
import FlowSubstep from 'components/FlowSubstep'
import Form from 'components/Form'
import TestSubstep from 'components/TestSubstep'
import { StepExecutionsProvider } from 'contexts/StepExecutions'
import { StepExecutionsToIncludeContext } from 'contexts/StepExecutionsToInclude'
import { GET_APPS } from 'graphql/queries/get-apps'
import { GET_STEP_WITH_TEST_EXECUTIONS } from 'graphql/queries/get-step-with-test-executions'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'

import StepHeader from './StepHeader'

type FlowStepProps = {
  collapsed?: boolean
  step: IStep
  index?: number
  onOpen?: () => void
  onClose?: () => void
  onChange: (step: IStep) => void
  onContinue?: () => void
}

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
  const { collapsed, onOpen, onClose, onChange, onContinue } = props
  const step: IStep = props.step
  const isTrigger = step.type === 'trigger'
  const isAction = step.type === 'action'

  const [currentSubstep, setCurrentSubstep] = useState<number | null>(0)

  // FIXME (ogp-weeloong): we shouldn't be querying for apps each time a step is
  // loaded. Let's fix this in another PR.
  const { data } = useQuery(GET_APPS, {
    variables: { onlyWithTriggers: isTrigger, onlyWithActions: isAction },
  })
  const [
    getStepWithTestExecutions,
    { data: stepWithTestExecutionsData, called: _stepWithTestExecutionsCalled },
  ] = useLazyQuery(GET_STEP_WITH_TEST_EXECUTIONS, {
    fetchPolicy: 'network-only',
  })
  useEffect(() => {
    if (!collapsed && !isTrigger) {
      // FIXME (ogp-weeloong): We shouldn't be making network requests each time
      // the user toggles a step. Let's fix this in a separate PR.
      getStepWithTestExecutions({
        variables: {
          stepId: step.id,
        },
      })
    }
  }, [collapsed, getStepWithTestExecutions, step.id, isTrigger])

  const stepExecutionsToInclude = useContext(StepExecutionsToIncludeContext)
  const stepExecutions = useMemo(
    () =>
      (stepWithTestExecutionsData?.getStepWithTestExecutions ?? []).filter(
        (stepExecution: IStep) =>
          stepExecutionsToInclude?.has(stepExecution.id) ?? true,
      ),
    [stepExecutionsToInclude, stepWithTestExecutionsData],
  )

  const apps: IApp[] = data?.getApps
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []

  const selectedActionOrTrigger = useMemo(
    () =>
      actionsOrTriggers.find(
        (actionOrTrigger: IAction | ITrigger) =>
          actionOrTrigger.key === step?.key,
      ),
    [actionsOrTriggers, step?.key],
  )
  const substeps = useMemo(
    () => selectedActionOrTrigger?.substeps || [],
    [selectedActionOrTrigger],
  )

  const handleChange = useCallback(({ step }: { step: IStep }) => {
    onChange(step)
  }, [])

  const expandNextStep = useCallback(() => {
    setCurrentSubstep((currentSubstep) => (currentSubstep ?? 0) + 1)
  }, [])

  const handleSubmit = (val: any) => {
    handleChange({ step: val as IStep })
  }

  const stepValidationSchema = useMemo(
    () => generateValidationSchema(substeps),
    [substeps],
  )

  const onStepHeaderClick = useCallback(() => {
    if (collapsed) {
      // We're currently collapsed, and user just expanded us.
      onOpen?.()
    } else {
      onClose?.()
    }
  }, [collapsed, onOpen, onClose])

  if (!apps) {
    return <CircularProgress isIndeterminate my={2} />
  }
  const toggleSubstep = (substepIndex: number) =>
    setCurrentSubstep((value) => (value !== substepIndex ? substepIndex : null))

  return (
    <StepHeader
      step={step}
      app={app}
      onClick={onStepHeaderClick}
      collapsed={collapsed ?? false}
    >
      <StepExecutionsProvider value={stepExecutions}>
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
              <Fragment key={`${substep?.name}-${index}`}>
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
                  ['chooseConnection', 'testStep'].includes(substep.key) ===
                    false && (
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
              </Fragment>
            ))}
        </Form>
      </StepExecutionsProvider>
    </StepHeader>
  )
}
