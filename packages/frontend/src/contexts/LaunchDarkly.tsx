import { Center } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import type { LDContext, LDEvaluationDetail } from 'launchdarkly-js-client-sdk'
import { basicLogger as LDLogger } from 'launchdarkly-js-client-sdk'
import type { ProviderConfig as LDProviderConfig } from 'launchdarkly-react-client-sdk'
import { useLDClient, withLDProvider } from 'launchdarkly-react-client-sdk'
import type { ReactNode } from 'react'
import { createContext, useEffect, useState } from 'react'

import PrimarySpinner from '@/components/PrimarySpinner'
import appConfig from '@/config/app'
import type { AuthenticationContextParams } from '@/contexts/Authentication'
import useAuthentication from '@/hooks/useAuthentication'

/**
 * Helper context that wraps around Launch Darkly's own LDProvider. It provides
 * convenience data (e.g. loaded flags, whether we're still loading data).
 */
export interface LaunchDarklyContextData {
  error: Error | null

  // Function to get flag value that ensures evaluation is tracked
  getFlagValue: (
    flagKey: string,
    defaultValue?: LDEvaluationDetail['value'],
  ) => LDEvaluationDetail['value']
}

export const LaunchDarklyContext = createContext<LaunchDarklyContextData>({
  error: null,
  getFlagValue: () => null,
})

const ANON_LD_CONTEXT: LDContext = {
  kind: 'user',
  anonymous: true,
  key: 'anon-plumber',
}

const INITIAL_SETTINGS: LDProviderConfig = {
  clientSideID: appConfig.launchDarklyClientId,
  options: {
    logger: LDLogger({ level: 'none' }),

    // Don't need live updates; our user machines are already slow enough. Will
    // ask users to manually refresh instead.
    streaming: false,

    // Add DataDog RUM inspector for automatic flag evaluation tracking
    inspectors: [
      {
        type: 'flag-used',
        name: 'dd-inspector',
        method: (key: string, detail: LDEvaluationDetail) => {
          datadogRum.addFeatureFlagEvaluation(key, detail.value)
        },
      },
    ],
  },
  reactOptions: {
    useCamelCaseFlagKeys: false,
  },

  // Initialize to a shared anon context, otherwise LD's identify (called on
  // login) won't work. We only use 1 MAU/MCI for this anon context, so it's OK.
  context: ANON_LD_CONTEXT,
}

/**
 * To manage MAU/MCI consumption, we only provide LD contexts for logged-in users.
 */
function getLDContext(
  user: AuthenticationContextParams['currentUser'] | null | undefined,
): LDContext {
  if (!user || !user.email) {
    return ANON_LD_CONTEXT
  }

  return {
    kind: 'user',
    key: user.email,
  }
}

function LaunchDarklySetup({ children }: { children: ReactNode }) {
  const Result = withLDProvider(INITIAL_SETTINGS)(() => <>{children}</>)
  return <Result />
}

function LaunchDarklyLDContextManager({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [reactContextData, setReactContextData] =
    useState<LaunchDarklyContextData>({
      error: null,
      getFlagValue: () => '',
    })

  const { currentUser } = useAuthentication()
  const ldClient = useLDClient()

  useEffect(() => {
    if (!ldClient) {
      return
    }

    ldClient.identify(getLDContext(currentUser), undefined, (error) => {
      setIsLoading(false)
      setReactContextData({
        error,
        getFlagValue: (flagKey: string, defaultValue?: boolean | string) => {
          if (!ldClient || error) {
            return defaultValue
          }
          try {
            // Use variation so that evaluation is tracked on LD dashboard
            // we choose this over variationDetail as its slightly faster
            // and we do not need the additiona evaluation information on the client
            return ldClient.variation(flagKey, defaultValue)
          } catch (e) {
            console.warn(`Failed to get variation for flag ${flagKey}:`, e)
            return defaultValue
          }
        },
      })
    })
  }, [currentUser, ldClient])

  return (
    <LaunchDarklyContext.Provider value={reactContextData}>
      {isLoading ? (
        <Center h="100vh">
          <PrimarySpinner fontSize="4xl" />
        </Center>
      ) : (
        children
      )}
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
