import type { IJSONObject } from '@plumber/types'
import pLimit from 'p-limit'

import { parseFormIdFromInput } from '@/apps/formsg/auth/verify-credentials'
import { checkLiveMrfStatus } from '@/apps/formsg/common/check-live-mrf-status'
import { parseFormEnvFromInput } from '@/apps/formsg/common/form-env'
import App from '@/models/app'
import type User from '@/models/user'

export interface McpConnection {
  id: string
  appKey: string
  verified: boolean
  label: string
}

export function connectionLabel(c: {
  formattedData?: IJSONObject
  description?: string
  key: string
}): string {
  return (
    (c.formattedData?.screenName as string | undefined) ??
    c.description ??
    c.key
  )
}

// Connections verified before PLU-866 (#1939) can still carry a stale
// "[MRF] " tag baked into their stored screenName — that logic tagged any
// form left in `multirespondent` responseMode even with no workflow
// configured, and was removed without backfilling already-verified
// connections. The tag only refreshes if the user re-verifies, so the AI
// Builder's connection picker can still show a "fake MRF" label for an old
// connection — and the model, told elsewhere that MRF is unsupported,
// reasonably refuses to use it. Live-check and strip the tag (display-only,
// no DB write) whenever we can positively confirm the form isn't MRF now.
const STALE_MRF_TAG_REGEX = /^(\[[A-Z]+\] )?\[MRF\] /

// Caps how many of these live checks can be in flight at once — connection
// labels are user-controlled (via updateConnection's formattedData), so an
// unbounded Promise.all over every connection would let a user with many
// stale-tagged connections fire an unbounded burst of concurrent outbound
// requests at FormSG's API.
const MRF_LIVE_CHECK_CONCURRENCY = 5
const mrfLiveCheckLimit = pLimit(MRF_LIVE_CHECK_CONCURRENCY)

async function resolveMcpConnectionLabel(c: {
  formattedData?: IJSONObject
  description?: string
  key: string
}): Promise<string> {
  const label = connectionLabel(c)

  if (c.key !== 'formsg' || !STALE_MRF_TAG_REGEX.test(label)) {
    return label
  }

  const rawFormId = c.formattedData?.formId as string | undefined
  if (!rawFormId) {
    return label
  }

  try {
    const formId = parseFormIdFromInput(rawFormId)
    const env = parseFormEnvFromInput(rawFormId)
    const isCurrentlyMrf = await mrfLiveCheckLimit(() =>
      checkLiveMrfStatus(formId, env),
    )
    if (isCurrentlyMrf === false) {
      return label.replace('[MRF] ', '')
    }
  } catch {
    // Unparseable formId on this connection — leave the label as-is.
  }

  return label
}

export async function listConnectionsService(
  user: User,
  appKey?: string,
): Promise<McpConnection[]> {
  // Mirrors the GetAppConnections GraphQL resolver (get-app.ts) which branches
  // on connectionType. Today only the pipe owner can invoke MCP tools, so we
  // return only connections the owner has access to.
  //
  // Collaborator support (future): the call site always has a flowId available.
  // When collaborators gain access, thread flowId through this function and:
  //   • system-added: also call getSharedConnections(flowId, isDraft=true) and
  //     return those shared connections, same as getApp does for editor-role users.
  //   • user-added: merge own connections with getSharedConnections(flowId,
  //     isDraft=false), same as getApp does for owner/viewer-role users.
  // See getSharedConnections in get-app.ts for the reference implementation.
  if (appKey) {
    const app = await App.findOneByKey(appKey)

    if (app?.auth?.connectionType === 'system-added') {
      // getSystemAddedConnections may insert new Connection rows for eligible
      // tenants as a side effect — this mirrors the GraphQL resolver's behaviour
      // and is intentional.
      const connections = await app.auth.getSystemAddedConnections(user)
      return Promise.all(
        connections.map(async (c) => ({
          id: c.id,
          appKey: c.key,
          verified: c.verified,
          label: await resolveMcpConnectionLabel(c),
        })),
      )
    }
  }

  // user-added connections (or no appKey — system-added across all apps is
  // not enumerable without iterating every app's auth handler)
  const query = user.$relatedQuery('connections').where('draft', false)
  if (appKey) {
    query.andWhere('key', appKey)
  }
  const connections = await query

  return Promise.all(
    connections.map(async (c) => ({
      id: c.id,
      appKey: c.key,
      verified: c.verified,
      label: await resolveMcpConnectionLabel(c),
    })),
  )
}
