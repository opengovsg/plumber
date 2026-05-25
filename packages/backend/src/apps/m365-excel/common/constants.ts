// Needed to break circular import between auth.getSystemAddedConnections and
// main app definition
export const APP_KEY = 'm365-excel'

export const MS_GRAPH_OAUTH_BASE_URL = 'https://login.microsoftonline.com'

export const GET_TABLE_ROWS_LIMIT = 500

export const LOOKUP_CONDITIONS_SUBFIELDS = [
  {
    placeholder: 'Lookup column',
    key: 'lookupColumn',
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    source: {
      type: 'query' as const,
      name: 'getDynamicData' as const,
      arguments: [
        {
          name: 'key',
          value: 'listTableColumns',
        },
        {
          name: 'parameters.fileId',
          value: '{parameters.fileId}',
        },
        {
          name: 'parameters.tableId',
          value: '{parameters.tableId}',
        },
      ],
    },
    customStyle: { flex: 2 },
  },
  {
    key: 'lookupValue' as const,
    placeholder: 'Lookup value',
    // We don't support matching on Excel-formatted text because it's very
    // weird (e.g. currency cells have a trailing space), and will lead to too
    // much user confusion.
    type: 'string' as const,
    required: false,
    variables: true,
    customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
  },
]
