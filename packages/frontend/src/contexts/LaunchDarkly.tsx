import type { ReactNode } from 'react'
import { createContext, useEffect, useState } from 'react'
import type { AuthenticationContextParams } from 'contexts/Authentication'
import useAuthentication from 'hooks/useAuthentication'
import type { LDContext, LDFlagSet } from 'launchdarkly-js-client-sdk'
import { basicLogger as LDLogger } from 'launchdarkly-js-client-sdk'
import type { ProviderConfig as LDProviderConfig } from 'launchdarkly-react-client-sdk'
import { useLDClient, withLDProvider } from 'launchdarkly-react-client-sdk'

/**
 * Helper context that wraps around Launch Darkly's own LDProvider. It provides
 * convenience data (e.g. loaded flags, whether we're still loading data).
 */
export interface LaunchDarklyContextData {
  isLoading: boolean
  error: Error | null

  // Null on first init, or if there was an error.
  flags: LDFlagSet | null
}

export const LaunchDarklyContext = createContext<LaunchDarklyContextData>({
  isLoading: false,
  flags: null,
  error: null,
})

const ANON_LD_CONTEXT: LDContext = {
  kind: 'user',
  anonymous: true,
  key: 'anon-plumber',
}

const INITIAL_SETTINGS: LDProviderConfig = {
  clientSideID: import.meta.env.VITE_LAUNCH_DARKLY_CLIENT_ID,
  options: {
    logger: LDLogger({ level: 'none' }),

    // Don't need live updates; our user machines are already slow enough. Will
    // ask users to manually refresh instead.
    streaming: false,
  },
  reactOptions: {
    useCamelCaseFlagKeys: false,
  },

  // Initialize to a shared anon context, otherwise LD's identify (called on
  // login) won't work. We only use 1 MAU/MCI for this anon context, so it's OK.
  context: ANON_LD_CONTEXT,
}

/**
 * To manage MAU/MCI consumption, we share LD contexts within population groups.
 */
function getLDContext(
  user: AuthenticationContextParams['currentUser'] | null | undefined,
): LDContext {
  if (!user) {
    return ANON_LD_CONTEXT
  }

  const domain = user.email.split('@')[1]
  if (!domain) {
    return ANON_LD_CONTEXT
  }

  return {
    kind: 'user',
    key: domain,
  }
}

function LaunchDarklySetup({ children }: { children: ReactNode }) {
  const Result = withLDProvider(INITIAL_SETTINGS)(() => <>{children}</>)
  return <Result />
}

function LaunchDarklyLDContextManager({ children }: { children: ReactNode }) {
  const [reactContextData, setReactContextData] =
    useState<LaunchDarklyContextData>({
      isLoading: false,
      flags: null,
      error: null,
    })

  const { currentUser } = useAuthentication()
  const ldClient = useLDClient()

  useEffect(() => {
    if (!ldClient) {
      return
    }

    setReactContextData({
      isLoading: true,
      flags: null,
      error: null,
    })
    ldClient.identify(getLDContext(currentUser), undefined, (error, flags) => {
      setReactContextData({
        isLoading: false,
        flags: error ? null : flags,
        error,
      })
    })
  }, [currentUser, ldClient])

  return (
    <LaunchDarklyContext.Provider value={reactContextData}>
      {children}
    </LaunchDarklyContext.Provider>
  )
}

export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  return (
    <LaunchDarklySetup>
      <LaunchDarklyLDContextManager>{children}</LaunchDarklyLDContextManager>
    </LaunchDarklySetup>
  )
}
