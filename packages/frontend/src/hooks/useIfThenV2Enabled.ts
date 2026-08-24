import type { LDClient, LDContext } from 'launchdarkly-js-client-sdk'
import { basicLogger as LDLogger, initialize } from 'launchdarkly-js-client-sdk'
import { useContext, useEffect, useMemo, useState } from 'react'

import { hasIfThenV2Block } from '@/components/Editor/helpers/steps-utils'
import appConfig from '@/config/app'
import { IF_THEN_THEN_FEATURE_FLAG } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

const OWNER_ROLE = 'owner'

/**
 * How to evaluate the if-then V2 flag for the pipe being edited. The flag is
 * scoped to the pipe owner, so a collaborator must evaluate it in the
 * owner's context rather than their own.
 */
export type PipeOwnerFlagPlan =
  | { kind: 'ownContext' }
  | { kind: 'pipeOwnerContext'; ownerEmail: string }
  | { kind: 'unresolvedOwner' }

export function planPipeOwnerFlagEvaluation(
  role: string | null | undefined,
  collaborators: ReadonlyArray<{ email?: string | null; role: string }>,
): PipeOwnerFlagPlan {
  // Own-context evaluation covers the owner and the common solo/no-role case,
  // so no second LaunchDarkly client is needed here.
  if (!role || role.toLowerCase() === OWNER_ROLE) {
    return { kind: 'ownContext' }
  }

  const ownerEmail = collaborators.find(
    (collaborator) => collaborator.role.toLowerCase() === OWNER_ROLE,
  )?.email
  if (!ownerEmail) {
    return { kind: 'unresolvedOwner' }
  }
  return { kind: 'pipeOwnerContext', ownerEmail }
}

export interface IfThenV2State {
  isEnabled: boolean
  /**
   * Only ever true on the collaborator path, while the pipe-scoped client
   * initialises. Callers gate their initial render on this so the UI mode
   * never flips after first paint.
   */
  isLoading: boolean
}

/**
 * Resolves whether the flow editor should render the if-then V2 UI for the
 * pipe currently being edited.
 *
 * A strict collaborator can't reuse the app's singleton LaunchDarkly client,
 * since browser SDKs only hold the logged-in user's pre-evaluated flags, and
 * re-identifying the singleton would re-scope every flag in the app. A
 * second, throwaway client is spun up in the owner's context to read just
 * this one flag, then closed. If it fails to initialise, or the owner can't
 * be resolved, the editor falls back to the old UI.
 */
export function useIfThenV2Enabled(): IfThenV2State {
  const { flow } = useContext(EditorContext)
  const { getFlagValue } = useContext(LaunchDarklyContext)

  const plan = useMemo(
    () => planPipeOwnerFlagEvaluation(flow.role, flow.collaborators ?? []),
    [flow.role, flow.collaborators],
  )

  const hasV2Block = useMemo(() => hasIfThenV2Block(flow.steps), [flow.steps])

  // Pipe-scoped state: only meaningful (and only updated) on the collaborator
  // path, where the owner's flag resolves asynchronously.
  const [pipeState, setPipeState] = useState<IfThenV2State>({
    isEnabled: false,
    isLoading: true,
  })

  useEffect(() => {
    // Already known to be enabled by content; skip spinning up a throwaway
    // pipe-scoped client to answer a question we don't need answered.
    if (hasV2Block || plan.kind !== 'pipeOwnerContext') {
      return
    }

    let isCancelled = false
    const ownerContext: LDContext = { kind: 'user', key: plan.ownerEmail }
    const pipeClient: LDClient = initialize(
      appConfig.launchDarklyClientId,
      ownerContext,
      {
        logger: LDLogger({ level: 'none' }),
        // Match the singleton client: no live updates, evaluate once on load.
        streaming: false,
      },
    )

    pipeClient
      .waitForInitialization()
      .then(() => {
        if (isCancelled) {
          return
        }
        setPipeState({
          isEnabled: Boolean(
            pipeClient.variation(IF_THEN_THEN_FEATURE_FLAG, false),
          ),
          isLoading: false,
        })
      })
      .catch((error) => {
        console.warn(
          'Failed to evaluate the if-then V2 flag for the pipe owner; ' +
            'falling back to the old editor UI.',
          error,
        )
        if (isCancelled) {
          return
        }
        setPipeState({ isEnabled: false, isLoading: false })
      })

    return () => {
      isCancelled = true
      pipeClient.close()
    }
  }, [plan, hasV2Block])

  if (hasV2Block) {
    return { isEnabled: true, isLoading: false }
  }

  if (plan.kind === 'ownContext') {
    return {
      isEnabled: Boolean(getFlagValue(IF_THEN_THEN_FEATURE_FLAG, false)),
      isLoading: false,
    }
  }

  if (plan.kind === 'unresolvedOwner') {
    return { isEnabled: false, isLoading: false }
  }

  return pipeState
}
