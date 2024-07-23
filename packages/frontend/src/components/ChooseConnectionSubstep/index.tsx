import type {
  IApp,
  IConnection,
  IStep,
  ISubstep,
  ITestConnectionOutput,
} from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Collapse, Flex } from '@chakra-ui/react'
import ChooseConnectionDropdown from 'components/ChooseConnectionDropdown'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import SetConnectionButton from 'components/SetConnectionButton'
import { EditorContext } from 'contexts/Editor'
import { REGISTER_CONNECTION } from 'graphql/mutations/register-connection'
import { GET_APP_CONNECTIONS } from 'graphql/queries/get-app-connections'
import { TEST_CONNECTION } from 'graphql/queries/test-connection'

type ChooseConnectionSubstepProps = {
  application: IApp
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
}

type ConnectionDropdownOption = {
  label: string
  value: string
  description?: string
}

const optionGenerator = (
  connection: IConnection,
): ConnectionDropdownOption => ({
  label: (connection?.formattedData?.screenName as string) ?? 'Unnamed',
  description: connection.key === 'formsg' ? connection?.id : undefined,
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
  } = props
  const { connection, appKey } = step
  const editorContext = useContext(EditorContext)
  const { data, loading, refetch } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })

  const supportsConnectionRegistration =
    !!application.auth?.connectionRegistrationType

  const {
    loading: testResultLoading,
    refetch: retestConnection,
    data: testConnectionData,
  } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: connection?.id,
      stepId: supportsConnectionRegistration ? step.id : undefined,
    },
    skip: !connection?.id,
  })

  const [registerConnection, { loading: registerConnectionLoading }] =
    useMutation(REGISTER_CONNECTION)

  const connectionOptions = useMemo(() => {
    const appWithConnections = data?.getApp as IApp
    const options =
      appWithConnections?.connections?.map((connection) =>
        optionGenerator(connection),
      ) || []

    return options
  }, [data])

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

  const onRegisterConnection = useCallback(async () => {
    if (step.connection?.id && supportsConnectionRegistration) {
      await registerConnection({
        variables: {
          input: {
            connectionId: step.connection.id,
            stepId: step.id,
          },
        },
      })
      await retestConnection()
    }
  }, [
    step,
    registerConnection,
    supportsConnectionRegistration,
    retestConnection,
  ])

  const onToggle = expanded ? onCollapse : onExpand

  const isTestStepValid = useMemo(() => {
    if (testResultLoading || !testConnectionData?.testConnection) {
      return null
    }
    if (
      testConnectionData?.testConnection?.connectionVerified === false ||
      testConnectionData.testConnection.registrationVerified === false
    ) {
      return false
    }
    return true
  }, [testConnectionData?.testConnection, testResultLoading])

  return (
    <>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={application?.substepLabels?.connectionStepLabel ?? name}
        valid={isTestStepValid}
      />
      <Collapse in={expanded} unmountOnExit>
        <Flex w="100%" p="1rem 1rem 1.5rem" flexDir="column" gap={4}>
          <ChooseConnectionDropdown
            isDisabled={editorContext.readOnly || loading}
            connectionOptions={connectionOptions}
            onChange={handleChange}
            value={connection?.id}
            application={application}
          />
          <SetConnectionButton
            onNextStep={onSubmit}
            onRegisterConnection={onRegisterConnection}
            readOnly={editorContext.readOnly}
            supportsConnectionRegistration={supportsConnectionRegistration}
            testResult={testConnectionData?.testConnection}
            testResultLoading={testResultLoading}
            registerConnectionLoading={registerConnectionLoading}
          />
        </Flex>
      </Collapse>
    </>
  )
}

export default ChooseConnectionSubstep
