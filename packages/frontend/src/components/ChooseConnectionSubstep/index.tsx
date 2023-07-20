import type { IApp, IConnection, IStep, ISubstep } from '@plumber/types'

import * as React from 'react'
import { useLazyQuery, useQuery } from '@apollo/client'
import { FormControl } from '@chakra-ui/react'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'
import { FormLabel } from '@opengovsg/design-system-react'
import AddAppConnection from 'components/AddAppConnection'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import { EditorContext } from 'contexts/Editor'
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
}

const ADD_CONNECTION_VALUE = 'ADD_CONNECTION'

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

const getOption = (
  options: Record<string, unknown>[],
  connectionId?: string,
): ConnectionDropdownOption | undefined =>
  (options.find(
    (connection) => connection.value === connectionId,
  ) as ConnectionDropdownOption) || undefined

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
  const formatMessage = useFormatMessage()
  const editorContext = React.useContext(EditorContext)
  const [showAddConnectionDialog, setShowAddConnectionDialog] =
    React.useState(false)
  const { data, loading, refetch } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  // TODO: show detailed error when connection test/verification fails
  const [
    testConnection,
    { loading: testResultLoading, refetch: retestConnection },
  ] = useLazyQuery(TEST_CONNECTION, {
    variables: {
      id: connection?.id,
    },
  })

  React.useEffect(() => {
    if (connection?.id) {
      testConnection({
        variables: {
          id: connection.id,
        },
      })
    }
    // intentionally no dependencies for initial test
  }, [])

  const connectionOptions = React.useMemo(() => {
    const appWithConnections = data?.getApp as IApp
    const options =
      appWithConnections?.connections?.map((connection) =>
        optionGenerator(connection),
      ) || []

    options.push({
      label: formatMessage('chooseConnectionSubstep.addNewConnection'),
      value: ADD_CONNECTION_VALUE,
    })

    return options
  }, [data, formatMessage])

  const { name } = substep

  const handleAddConnectionClose = React.useCallback(
    async (response: Record<string, unknown>) => {
      setShowAddConnectionDialog(false)

      const connectionId = (response?.createConnection as any)?.id

      if (connectionId) {
        await refetch()

        onChange({
          step: {
            ...step,
            connection: {
              id: connectionId,
            },
          },
        })
      }
    },
    [onChange, refetch, step],
  )

  const handleChange = React.useCallback(
    (event: React.SyntheticEvent, selectedOption: unknown) => {
      if (typeof selectedOption === 'object') {
        // TODO: try to simplify type casting below.
        const typedSelectedOption = selectedOption as { value: string }
        const option: { value: string } = typedSelectedOption
        const connectionId = option?.value as string

        if (connectionId === ADD_CONNECTION_VALUE) {
          setShowAddConnectionDialog(true)
          return
        }

        if (connectionId !== step.connection?.id) {
          onChange({
            step: {
              ...step,
              connection: {
                id: connectionId,
              },
            },
          })
        }
      }
    },
    [step, onChange],
  )

  React.useEffect(() => {
    if (step.connection?.id) {
      retestConnection({
        id: step.connection.id,
      })
    }
  }, [step.connection?.id, retestConnection])

  const onToggle = expanded ? onCollapse : onExpand

  return (
    <React.Fragment>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={name}
        valid={testResultLoading ? null : connection?.verified}
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
            options={connectionOptions}
            renderInput={(params) => (
              <FormControl>
                <FormLabel isRequired>
                  {formatMessage('chooseConnectionSubstep.chooseConnection')}
                </FormLabel>
                <TextField {...params} />
              </FormControl>
            )}
            value={getOption(connectionOptions, connection?.id)}
            onChange={handleChange}
            loading={loading}
            data-test="choose-connection-autocomplete"
            isOptionEqualToValue={(
              option: ConnectionDropdownOption,
              value: ConnectionDropdownOption,
            ) => option.value === value.value}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={onSubmit}
            sx={{ mt: 2 }}
            disabled={
              testResultLoading ||
              !connection?.verified ||
              editorContext.readOnly
            }
            data-test="flow-substep-continue-button"
          >
            {formatMessage('chooseConnectionSubstep.continue')}
          </Button>
        </ListItem>
      </Collapse>

      {application && showAddConnectionDialog && (
        <AddAppConnection
          onClose={handleAddConnectionClose}
          application={application}
        />
      )}
    </React.Fragment>
  )
}

export default ChooseConnectionSubstep
