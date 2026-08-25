import { AnyQueryBuilder, ref } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
import FlowFolder, {
  FLOW_FOLDER_COLORS,
  type FlowFolderColor,
} from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import User from '@/models/user'

export const FLOW_FOLDER_NAME_MAX_LENGTH = 60

/**
 * Trims and validates a folder name: non-empty, at most 60 characters.
 * Duplicate names for the same user are allowed - they're just labels.
 */
export function validateFlowFolderName(name: string): string {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new BadUserInputError('Folder name cannot be empty.')
  }

  if (trimmedName.length > FLOW_FOLDER_NAME_MAX_LENGTH) {
    throw new BadUserInputError(
      `Folder name cannot be longer than ${FLOW_FOLDER_NAME_MAX_LENGTH} characters.`,
    )
  }

  return trimmedName
}

/**
 * Validates that a colour is one of the 6 tokens the frontend swatches map
 * to.
 */
export function validateFlowFolderColor(color: string): FlowFolderColor {
  if (!(FLOW_FOLDER_COLORS as readonly string[]).includes(color)) {
    throw new BadUserInputError(
      `Folder colour must be one of: ${FLOW_FOLDER_COLORS.join(', ')}.`,
    )
  }

  return color as FlowFolderColor
}

/**
 * All folder-related query logic lives here, so the feature stays removable.
 *
 * Applies an optional folder filter to a `flows`-based query builder.
 *
 * - `folderId` set: only flows filed into that folder (by this user).
 * - `unfiled: true`: only flows this user has not filed into any folder.
 * - Neither set: no-op. This is what keeps today's `getFlows` behaviour
 *   byte-for-byte unchanged for users who never touch folders.
 */
export function applyFolderFilter(
  builder: AnyQueryBuilder,
  opts: {
    folderId?: string | null
    unfiled?: boolean | null
    userId: string
  },
): void {
  const { folderId, unfiled, userId } = opts

  if (folderId != null) {
    builder.whereExists(
      FlowFolderItem.query()
        .select(1)
        .where('flow_folder_items.user_id', userId)
        .where('flow_folder_items.folder_id', folderId)
        .where('flow_folder_items.flow_id', ref('flows.id')),
    )
    return
  }

  if (unfiled) {
    builder.whereNotExists(
      FlowFolderItem.query()
        .select(1)
        .where('flow_folder_items.user_id', userId)
        .where('flow_folder_items.flow_id', ref('flows.id')),
    )
  }
}

interface PendingFolderBatch {
  flowIds: Set<string>
  scheduled: boolean
  waiters: Map<string, Array<(folder: FlowFolder | null) => void>>
}

function toFolderSummary(folder: {
  id: string
  name: string
  color: FlowFolderColor
}): FlowFolder {
  const summary = new FlowFolder()
  summary.id = folder.id
  summary.name = folder.name
  summary.color = folder.color
  return summary
}

// Keyed by the GraphQL request's `context` object (a fresh object per
// request), so batches never leak across requests.
const pendingBatches = new WeakMap<object, PendingFolderBatch>()

/**
 * Batches concurrent `Flow.folder` field resolutions within a single
 * GraphQL request into a single query, instead of one query per flow.
 *
 * Every call made during the same tick (i.e. every sibling `Flow.folder`
 * resolver GraphQL fires off in parallel) is coalesced; the batch is
 * flushed on the next microtask tick.
 */
export function loadFlowFolder({
  requestKey,
  userId,
  flowId,
}: {
  requestKey: object
  userId: string
  flowId: string
}): Promise<FlowFolder | null> {
  let batch = pendingBatches.get(requestKey)
  if (!batch) {
    batch = { flowIds: new Set(), scheduled: false, waiters: new Map() }
    pendingBatches.set(requestKey, batch)
  }

  batch.flowIds.add(flowId)

  const promise = new Promise<FlowFolder | null>((resolve) => {
    const waiters = batch.waiters.get(flowId) ?? []
    waiters.push(resolve)
    batch.waiters.set(flowId, waiters)
  })

  if (!batch.scheduled) {
    batch.scheduled = true
    const currentBatch = batch
    queueMicrotask(() => {
      pendingBatches.delete(requestKey)
      void flushFolderBatch({ userId, batch: currentBatch })
    })
  }

  return promise
}

async function flushFolderBatch({
  userId,
  batch,
}: {
  userId: string
  batch: PendingFolderBatch
}): Promise<void> {
  const items = await FlowFolderItem.query()
    .where('user_id', userId)
    .whereIn('flow_id', Array.from(batch.flowIds))
    .withGraphFetched('folder')

  const foldersByFlowId = new Map<string, FlowFolder | null>()
  for (const item of items) {
    if (item.folder) {
      foldersByFlowId.set(item.flowId, toFolderSummary(item.folder))
    }
  }

  for (const [flowId, waiters] of batch.waiters) {
    const folder = foldersByFlowId.get(flowId) ?? null
    waiters.forEach((resolve) => resolve(folder))
  }
}

/**
 * Counts, per folder, how many of `currentUser`'s accessible, non-deleted
 * flows are filed into it. Always issues a single grouped query regardless
 * of how many folders exist, so callers (e.g. `getFlowFolders`) never N+1.
 */
export async function countFlowsByFolder(
  currentUser: User,
): Promise<Record<string, number>> {
  const rows = await FlowFolderItem.query()
    .select('folder_id')
    .count('* as count')
    .where('flow_folder_items.user_id', currentUser.id)
    .whereExists(
      currentUser
        .withAccessibleFlows({ requiredRole: 'viewer' })
        .select(1)
        .where('flows.id', ref('flow_folder_items.flow_id')),
    )
    .groupBy('folder_id')

  return Object.fromEntries(
    (rows as unknown as { folderId: string; count: string }[]).map((row) => [
      row.folderId,
      Number(row.count),
    ]),
  )
}

/**
 * Counts `currentUser`'s accessible, non-deleted flows that are not filed
 * into any folder. A single `COUNT(*)` reusing the exact accessible-flows +
 * `whereNotExists` shape as `applyFolderFilter`'s `unfiled` branch, so the
 * rail's "Unfiled" number doesn't require re-running the whole `getFlows`
 * resolver just to read `pageInfo.totalCount`.
 */
export async function countUnfiledFlows(currentUser: User): Promise<number> {
  const result = await currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .where((builder) => {
      applyFolderFilter(builder, { unfiled: true, userId: currentUser.id })
    })
    .resultSize()

  return result
}
