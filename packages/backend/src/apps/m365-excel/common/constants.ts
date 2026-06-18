// Needed to break circular import between auth.getSystemAddedConnections and
// main app definition
export const APP_KEY = 'm365-excel'

export const MS_GRAPH_OAUTH_BASE_URL = 'https://login.microsoftonline.com'

export const GET_TABLE_ROWS_LIMIT = 500

// Testing a step with a very wide table can generate a huge amount of data
// out, which causes problems (e.g. slow/failed step test) downstream. Cap the
// number of columns returned when the step is only being tested.
export const TEST_STEP_MAX_COLUMNS = 100

export const MAX_LOOKUP_CONDITIONS = 3

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
// Per-request timeout for all m365 (Graph + OAuth) HTTP calls. Without it axios
// waits on the OS TCP timeout (minutes) for a hung request. We hold the per-file
// distributed lock across an action's requests and renew it on a heartbeat, so a
// hung request would otherwise keep the (renewed) lock held indefinitely. Bounding
// a single request to 3 min - bounded against the lock TTL (LOCK_TTL_MS in
// helpers/distributed-lock.ts, kept alive by auto-extension while the request
// runs) - guarantees the lock is released within a knowable window. Graph calls normally
// finish in seconds, so this is a ceiling, not a target.
export const M365_REQUEST_TIMEOUT_MS = 3 * 60 * 1000
