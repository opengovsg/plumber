import type { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import {
  Fragment,
  type MouseEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import { CircularProgress } from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'

import ChooseAppAndEventSubstep from '@/components/ChooseAppAndEventSubstep'
import ChooseConnectionSubstep from '@/components/ChooseConnectionSubstep'
import FlowStepHeader from '@/components/FlowStepHeader'
import FlowSubstep from '@/components/FlowSubstep'
import Form from '@/components/Form'
import TestSubstep from '@/components/TestSubstep'
import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { StepExecutionsProvider } from '@/contexts/StepExecutions'
import { StepExecutionsToIncludeContext } from '@/contexts/StepExecutionsToInclude'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_STEP_WITH_TEST_EXECUTIONS } from '@/graphql/queries/get-step-with-test-executions'

type FlowStepProps = {
  collapsed?: boolean
  step: IStep
  isLastStep: boolean
  index?: number
  onOpen: () => void
  onClose: () => void
  onChange: (step: IStep) => void
  onContinue?: () => void
}

// FIXME (ogp-weeloong): remove this; not needed since we already do validation in FlowSubstep.
function generateValidationSchema(substeps: ISubstep[]) {
  const fieldValidations = substeps?.reduce(
    (allValidations, { arguments: args }) => {
      if (!args || !Array.isArray(args)) {
        return allValidations
      }

      const substepArgumentValidations: Record<string, BaseSchema> = {}

      for (const arg of args) {
        const { key, required, hiddenIf } = arg

        // base validation for the field if not exists
        if (!substepArgumentValidations[key]) {
          substepArgumentValidations[key] = yup.mixed()
        }

        if (typeof substepArgumentValidations[key] === 'object') {
          // if the field is required and not conditionally hidden, add the
          // required validation
          if (required && !hiddenIf) {
            substepArgumentValidations[key] = substepArgumentValidations[
              key
            ].required(`${key} is required.`)
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
  const { step, isLastStep, collapsed, onOpen, onClose, onChange, onContinue } =
    props
  const isTrigger = step.type === 'trigger'

  const editorContext = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]

  const cannotChooseApp = displayOverrides?.disableActionChanges ?? false
  const [currentSubstep, setCurrentSubstep] = useState<number | null>(
    // OK to set to 1, even if a step has _no_ substeps, everything will just be
    // collapsed due to matching logic below.
    cannotChooseApp ? 1 : 0,
  )

  const { data } = useQuery(GET_APPS)
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

  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )
  const app = apps?.find((currentApp: IApp) => currentApp.key === step.appKey)

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
  const substeps = useMemo(
    () => selectedActionOrTrigger?.substeps || [],
    [selectedActionOrTrigger],
  )

  const handleChange = useCallback(
    ({ step }: { step: IStep }) => {
      onChange(step)
    },
    [onChange],
  )

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

  const isDeletable =
    displayOverrides?.disableDelete === true
      ? false
      : !isTrigger && !editorContext.readOnly
  const [deleteStep] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { ids: [step.id] } } })
    },
    [deleteStep, step.id],
  )

  // define caption description based on app and step
  let caption = ''
  if (selectedActionOrTrigger?.name) {
    caption = `${step.position}. ${selectedActionOrTrigger?.name}`
  } else if (app?.name) {
    caption = `${step.position}. ${app.name}`
  } else if (isTrigger) {
    caption = 'This step starts your pipe'
  } else if (step.position === 2) {
    caption = 'This step happens after your pipe starts'
  } else {
    caption = 'This step happens after the previous step'
  }

  if (!apps) {
    return <CircularProgress isIndeterminate my={2} />
  }
  const toggleSubstep = (substepIndex: number) =>
    setCurrentSubstep((value) => (value !== substepIndex ? substepIndex : null))

  return (
    <FlowStepHeader
      iconUrl={app?.iconUrl}
      caption={displayOverrides?.caption ?? caption}
      hintAboveCaption={
        displayOverrides?.hintAboveCaption ?? (isTrigger ? 'When' : 'Then')
      }
      isCompleted={step.status === 'completed'}
      onDelete={isDeletable ? onDelete : undefined}
      onOpen={onOpen}
      onClose={onClose}
      collapsed={collapsed ?? false}
      demoVideoUrl={app?.demoVideoDetails?.url}
      demoVideoTitle={app?.demoVideoDetails?.title}
    >
      <StepExecutionsProvider value={stepExecutions}>
        <Form
          defaultValues={step}
          onSubmit={handleSubmit}
          resolver={stepValidationSchema}
        >
          {!cannotChooseApp && (
            <ChooseAppAndEventSubstep
              expanded={currentSubstep === 0}
              substep={{
                key: 'chooseAppAndEvent',
                name: 'Choose app & event',
                arguments: [],
              }}
              onExpand={() => toggleSubstep(0)}
              onCollapse={() => toggleSubstep(0)}
              onSubmit={expandNextStep}
              onChange={handleChange}
              step={step}
              isLastStep={isLastStep}
            />
          )}

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
                      settingsLabel={
                        selectedActionOrTrigger?.settingsStepLabel ??
                        app?.substepLabels?.settingsStepLabel
                      }
                    />
                  )}
              </Fragment>
            ))}
        </Form>
      </StepExecutionsProvider>
    </FlowStepHeader>
  )
}
