import type {
  IAction,
  IApp,
  IConnection,
  IStep,
  ISubstep,
  ITestConnectionOutput,
  ITrigger,
} from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import ChooseConnectionDropdown from 'components/ChooseConnectionDropdown'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import SetConnectionButton from 'components/SetConnectionButton'
import { EditorContext } from 'contexts/Editor'
import { REGISTER_WEBHOOK } from 'graphql/mutations/register-webhook'
import { GET_APP_CONNECTIONS } from 'graphql/queries/get-app-connections'
import { TEST_CONNECTION } from 'graphql/queries/test-connection'
import useFormatMessage from 'hooks/useFormatMessage'

type ChooseConnectionSubstepProps = {
  application: IApp
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

type ConnectionDropdownOption = {
  label: string
  value: string
}

const optionGenerator = (
  connection: IConnection,
): ConnectionDropdownOption => ({
  label: (connection?.formattedData?.screenName as string) ?? 'Unnamed',
  value: connection?.id as string,
})

function ChooseConnectionSubstep(
  props: ChooseConnectionSubstepProps,
): React.ReactElement {
  const {
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    step,
    onSubmit,
    onChange,
    application,
    selectedActionOrTrigger,
  } = props
  const { connection, appKey } = step
  const formatMessage = useFormatMessage()
  const editorContext = useContext(EditorContext)
  const { data, loading, refetch } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  const supportsWebhookRegistration =
    (selectedActionOrTrigger as ITrigger)?.supportsWebhookRegistration || false

  const {
    loading: testResultLoading,
    refetch: retestConnection,
    data: testConnectionData,
  } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: connection?.id,
      stepId: supportsWebhookRegistration ? step.id : undefined,
    },
    skip: !connection?.id,
  })

  const [registerWebhook, { loading: registerWebhookLoading }] =
    useMutation(REGISTER_WEBHOOK)

  const connectionOptions = useMemo(() => {
    const appWithConnections = data?.getApp as IApp
    const options =
      appWithConnections?.connections?.map((connection) =>
        optionGenerator(connection),
      ) || []

    return options
  }, [data, formatMessage])

  const { name } = substep

  const handleChange = useCallback(
    async (connectionId: string, shouldRefetch: boolean) => {
      if (connectionId === step.connection?.id) {
        return
      }
      if (shouldRefetch) {
        await refetch()
      }
      onChange({
        step: {
          ...step,
          connection: {
            id: connectionId,
          },
        },
      })
    },
    [step, onChange, refetch],
  )

  const onRegisterWebhook = useCallback(async () => {
    if (step.connection?.id && supportsWebhookRegistration) {
      await registerWebhook({
        variables: {
          input: {
            connectionId: step.connection.id,
            stepId: step.id,
          },
        },
      })
      await retestConnection()
    }
  }, [step, registerWebhook, supportsWebhookRegistration])

  const onToggle = expanded ? onCollapse : onExpand

  const isTestStepValid = useMemo(() => {
    if (testResultLoading || !testConnectionData?.testConnection) {
      return null
    }
    if (
      testConnectionData?.testConnection?.connectionVerified === false ||
      testConnectionData.testConnection.webhookVerified === false
    ) {
      return false
    }
    return true
  }, [testResultLoading || testConnectionData])

  return (
    <>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={name}
        valid={isTestStepValid}
      />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <ListItem
          sx={{
            pt: 2,
            pb: 3,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <ChooseConnectionDropdown
            isDisabled={editorContext.readOnly || loading}
            connectionOptions={connectionOptions}
            onChange={handleChange}
            value={connection?.id}
            application={application}
          />
          <SetConnectionButton
            onNextStep={onSubmit}
            onRegisterWebhook={onRegisterWebhook}
            readOnly={editorContext.readOnly}
            supportsWebhookRegistration={supportsWebhookRegistration}
            testResult={testConnectionData?.testConnection}
            testResultLoading={testResultLoading}
            registerWebhookLoading={registerWebhookLoading}
          />
        </ListItem>
      </Collapse>
    </>
  )
}

export default ChooseConnectionSubstep
