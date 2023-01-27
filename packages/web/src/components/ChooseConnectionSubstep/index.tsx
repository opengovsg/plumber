import * as React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ListItem from '@mui/material/ListItem';
import Autocomplete from '@mui/material/Autocomplete';

import type { IApp, IConnection, IStep, ISubstep } from '@automatisch/types';
import useFormatMessage from 'hooks/useFormatMessage';
import { EditorContext } from 'contexts/Editor';
import FlowSubstepTitle from 'components/FlowSubstepTitle';
import AddAppConnection from 'components/AddAppConnection';
import { GET_APP_CONNECTIONS } from 'graphql/queries/get-app-connections';
import { TEST_CONNECTION } from 'graphql/queries/test-connection';

type ChooseConnectionSubstepProps = {
  application: IApp;
  substep: ISubstep;
  expanded?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onChange: ({ step }: { step: IStep }) => void;
  onSubmit: () => void;
  step: IStep;
};

const ADD_CONNECTION_VALUE = 'ADD_CONNECTION';

const optionGenerator = (
  connection: IConnection
): { label: string; value: string } => ({
  label: (connection?.formattedData?.screenName as string) ?? 'Unnamed',
  value: connection?.id as string,
});

const getOption = (options: Record<string, unknown>[], connectionId?: string) =>
  options.find((connection) => connection.value === connectionId) || undefined;

function ChooseConnectionSubstep(
  props: ChooseConnectionSubstepProps
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
  } = props;
  const { connection, appKey } = step;
  const formatMessage = useFormatMessage();
  const editorContext = React.useContext(EditorContext);
  const [showAddConnectionDialog, setShowAddConnectionDialog] =
    React.useState(false);
  const { data, loading, refetch } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  });
  // TODO: show detailed error when connection test/verification fails
  const [
    testConnection,
    { loading: testResultLoading, refetch: retestConnection },
  ] = useLazyQuery(TEST_CONNECTION, {
    variables: {
      id: connection?.id,
    },
  });

  React.useEffect(() => {
    if (connection?.id) {
      testConnection({
        variables: {
          id: connection.id,
        },
      });
    }
    // intentionally no dependencies for initial test
  }, []);

  const connectionOptions = React.useMemo(() => {
    const appWithConnections = data?.getApp as IApp;
    const options =
      appWithConnections?.connections?.map((connection) =>
        optionGenerator(connection)
      ) || [];

    options.push({
      label: formatMessage('chooseConnectionSubstep.addNewConnection'),
      value: ADD_CONNECTION_VALUE,
    });

    return options;
  }, [data, formatMessage]);

  const { name } = substep;

  const handleAddConnectionClose = React.useCallback(
    async (response: Record<string, unknown>) => {
      setShowAddConnectionDialog(false);

      const connectionId = (response?.createConnection as any).id;

      if (connectionId) {
        await refetch();

        onChange({
          step: {
            ...step,
            connection: {
              id: connectionId,
            },
          },
        });
      }
    },
    [onChange, refetch, step]
  );

  const handleChange = React.useCallback(
    (event: React.SyntheticEvent, selectedOption: unknown) => {
      if (typeof selectedOption === 'object') {
        // TODO: try to simplify type casting below.
        const typedSelectedOption = selectedOption as { value: string };
        const option: { value: string } = typedSelectedOption;
        const connectionId = option?.value as string;

        if (connectionId === ADD_CONNECTION_VALUE) {
          setShowAddConnectionDialog(true);
          return;
        }

        if (connectionId !== step.connection?.id) {
          onChange({
            step: {
              ...step,
              connection: {
                id: connectionId,
              },
            },
          });
        }
      }
    },
    [step, onChange]
  );

  React.useEffect(() => {
    if (step.connection?.id) {
      retestConnection({
        id: step.connection.id,
      });
    }
  }, [step.connection?.id, retestConnection]);

  const onToggle = expanded ? onCollapse : onExpand;

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
              <TextField
                {...params}
                label={formatMessage(
                  'chooseConnectionSubstep.chooseConnection'
                )}
              />
            )}
            value={getOption(connectionOptions, connection?.id)}
            onChange={handleChange}
            loading={loading}
            data-test="choose-connection-autocomplete"
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
  );
}

export default ChooseConnectionSubstep;
