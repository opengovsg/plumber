import type { IApp, IFlow } from '@plumber/types'

import { useContext, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Center } from '@chakra-ui/react'

import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { EditorContext, EditorProvider } from '@/contexts/Editor'
import { CREATE_FLOW } from '@/graphql/mutations/create-flow'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  FORMSG_APP_KEY,
  FORMSG_TRIGGER_KEY,
  parseFormsgScreenName,
} from '@/helpers/formsg'

interface FormStepModalProps {
  formId: string
  onClose: () => void
}

function FormStepModal({ formId, onClose }: FormStepModalProps) {
  const { flow, allApps } = useContext(EditorContext)

  const app = allApps.find((app) => app.key === FORMSG_APP_KEY)
  const event = app?.triggers?.find((event) => event.key === FORMSG_TRIGGER_KEY)
  const triggerStep = flow.steps.find((step) => step.type === 'trigger')

  const { data, loading } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: FORMSG_APP_KEY, flowId: flow.id },
  })

  if (loading) {
    return null
  }

  // Only prod forms are matched since the prefilled URL below is a prod URL.
  const existingConnection = (
    data?.getApp as IApp | undefined
  )?.connections?.find((connection) => {
    const env = (connection.formattedData?.env as string) ?? 'prod'
    const screenName = connection.formattedData?.screenName as string
    return (
      connection.verified &&
      env === 'prod' &&
      !!screenName &&
      parseFormsgScreenName(screenName, env).formId === formId
    )
  })

  if (!app || !event || !triggerStep) {
    return <Navigate to={URLS.FLOW_EDITOR(flow.id)} replace />
  }

  return (
    <FlowStepConfigurationModal
      onClose={onClose}
      isTrigger
      isLastStep={flow.steps.length === 1}
      step={triggerStep}
      app={app}
      event={event}
      initialConnectionId={existingConnection?.id}
      prefilledConnectionFields={
        existingConnection
          ? undefined
          : { formId: `https://form.gov.sg/${formId}` }
      }
    />
  )
}

interface FormChildProps {
  formId: string
  name: string
}

export const FormChild = ({ formId, name }: FormChildProps) => {
  const navigate = useNavigate()
  const [flowId, setFlowId] = useState<string | null>(null)
  const [shouldWarnOnLeave, setShouldWarnOnLeave] = useState(false)
  const [createFlow] = useMutation(CREATE_FLOW)

  // Guards against creating two pipes when React runs effects twice in dev.
  const hasStartedCreation = useRef(false)

  useEffect(() => {
    if (hasStartedCreation.current) {
      return
    }
    hasStartedCreation.current = true

    createFlow({ variables: { input: { flowName: name } } })
      .then((response) => {
        const id = response.data?.createFlow?.id
        if (!id) {
          throw new Error('Pipe was not created')
        }
        setFlowId(id)
      })
      .catch(() => navigate(URLS.FLOWS, { replace: true }))
  }, [createFlow, name, navigate])

  const { data } = useQuery(GET_FLOW, {
    variables: { id: flowId },
    skip: !flowId,
  })
  const flow: IFlow | undefined = data?.getFlow

  if (!flowId || !flow) {
    return (
      <Center h="100vh">
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  return (
    <EditorProvider
      flow={flow}
      shouldWarnOnLeave={shouldWarnOnLeave}
      setShouldWarnOnLeave={setShouldWarnOnLeave}
    >
      <FormStepModal
        formId={formId}
        onClose={() => navigate(URLS.FLOW_EDITOR(flowId), { replace: true })}
      />
    </EditorProvider>
  )
}

export const Form = () => {
  const [searchParams] = useSearchParams()
  const formId = searchParams.get('formId')
  const name = searchParams.get('name')

  if (!formId || !name) {
    return <Navigate to={URLS.FLOWS} replace />
  }

  return <FormChild formId={formId} name={name} />
}
