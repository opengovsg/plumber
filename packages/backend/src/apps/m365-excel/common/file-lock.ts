import type { IGlobalVariable } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { extractAuthDataWithPlumberFolder } from './auth-data'

//
// Lock-key derivation for m365-excel actions.
//
// WorkbookSession relies on all reads/writes to the same file being serialized
// (it stores one shared session id per file in Redis with "no synchronization
// needed"). That serialization used to come from the per-app queue's per-file
// `group.concurrency: 1`; splitting `createTableRow` onto its own batch queue
// broke it. Every m365 action that opens a WorkbookSession therefore declares
// this as its `getLockKey` hook, so the execution path (processAction / the
// batch worker) acquires a per-file lock around `run` / `runBatch` — restoring
// per-file serialization across BOTH queues and test runs.
//
// The lock itself is the generic primitive in `helpers/distributed-lock.ts`;
// here we only derive the resource key (`<tenant>:<fileId>`).
//

export const getLockKey = async (
  $: IGlobalVariable,
): Promise<string | null> => {
  const fileId = $.step?.parameters?.fileId as string | undefined
  if (!fileId) {
    return null
  }

  try {
    const authData = extractAuthDataWithPlumberFolder($)
    const tenant = getM365TenantInfo(authData.tenantKey)
    return `${tenant.id}:${fileId}`
  } catch {
    // Can't derive the tenant (e.g. malformed / missing auth). Skip locking and
    // let the action's run path surface and record the real error, preserving
    // the pre-lock failure behavior.
    return null
  }
}
