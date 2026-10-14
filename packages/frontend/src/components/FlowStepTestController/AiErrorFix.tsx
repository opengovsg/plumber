import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { BiSolidMagicWand } from 'react-icons/bi'
import { useApolloClient } from '@apollo/client'
import { Box, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import Loader from '@/pages/AiBuilder/components/ChatMessages/Loader'
import posthog, { isPostHogConfigured } from '@/posthog'

import { requestStepErrorFix, type StepErrorFixResult } from './step-error-fix'

type FixPhase = 'idle' | 'loading' | 'result' | 'failed'

type AiErrorFixProviderProps = {
  children: ReactNode
  stepId: string
  appName: string
  appKey: string
  stepKey: string
  stepName: string
  errorName: string
  errorSolution?: string
}

type AiErrorFixContextValue = {
  failureMessage: string
  phase: FixPhase
  requestFix: () => Promise<void>
  result: StepErrorFixResult | null
}

const stepFixNotices = new Map<string, StepErrorFixResult>()
const stepFixNoticeListeners = new Set<() => void>()

function publishStepFixNotice(): void {
  stepFixNoticeListeners.forEach((listener) => listener())
}

export function setStepFixNotice(
  stepId: string,
  result: StepErrorFixResult,
): void {
  stepFixNotices.set(stepId, result)
  publishStepFixNotice()
}

export function clearStepFixNotice(stepId: string): void {
  if (!stepFixNotices.delete(stepId)) {
    return
  }
  publishStepFixNotice()
}

function useStepFixNotice(stepId: string): StepErrorFixResult | null {
  return useSyncExternalStore(
    (listener) => {
      stepFixNoticeListeners.add(listener)
      return () => stepFixNoticeListeners.delete(listener)
    },
    () => stepFixNotices.get(stepId) ?? null,
  )
}

const AiErrorFixContext = createContext<AiErrorFixContextValue | null>(null)

function useAiErrorFix(): AiErrorFixContextValue {
  const value = useContext(AiErrorFixContext)
  if (!value) {
    throw new Error('AiErrorFix must be used inside AiErrorFix.Provider')
  }
  return value
}

function AiErrorFixProvider(props: AiErrorFixProviderProps) {
  const { children, ...request } = props
  const client = useApolloClient()
  const { resetForm } = useContext(EditorContext)
  const [phase, setPhase] = useState<FixPhase>('idle')
  const [result, setResult] = useState<StepErrorFixResult | null>(null)
  const savedNotice = useStepFixNotice(request.stepId)
  const [failureMessage, setFailureMessage] = useState(
    'AI could not fix this step. Your settings were not changed.',
  )

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const requestFix = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('loading')
    clearStepFixNotice(request.stepId)
    if (isPostHogConfigured) {
      posthog.capture('check_step:ai_fix_requested', {
        appKey: request.appKey,
        stepKey: request.stepKey,
      })
    }
    try {
      const fixResult = await requestStepErrorFix(request, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      if (fixResult.fixed) {
        setStepFixNotice(request.stepId, fixResult)
        await client.refetchQueries({ include: [GET_FLOW] })
        resetForm()
      }
      setResult(fixResult)
      setPhase('result')
      if (isPostHogConfigured) {
        posthog.capture('check_step:ai_fix_completed', {
          appKey: request.appKey,
          stepKey: request.stepKey,
          fixed: fixResult.fixed,
        })
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      setFailureMessage(
        error instanceof Error && error.message
          ? error.message
          : 'AI could not fix this step. Your settings were not changed.',
      )
      setPhase('failed')
      if (isPostHogConfigured) {
        posthog.capture('check_step:ai_fix_failed', {
          appKey: request.appKey,
          stepKey: request.stepKey,
        })
      }
    }
  }

  return (
    <AiErrorFixContext.Provider
      value={{
        failureMessage,
        phase,
        requestFix,
        result: phase === 'idle' ? savedNotice : result,
      }}
    >
      {children}
    </AiErrorFixContext.Provider>
  )
}

function AiErrorFixAction() {
  const { phase, requestFix, result } = useAiErrorFix()

  if (result?.fixed && phase !== 'loading') {
    return null
  }

  return (
    <Box h="32px" display="flex" alignItems="center" flexShrink={0}>
      {phase === 'loading' ? (
        <Box
          display="flex"
          alignItems="center"
          gap={3}
          h="32px"
          textStyle="subhead-2"
          textTransform="uppercase"
          fontWeight={500}
          color="gray.500"
          aria-live="polite"
        >
          Working
          <Loader />
        </Box>
      ) : (
        <Button
          size="sm"
          h="32px"
          minH="32px"
          variant="link"
          leftIcon={<BiSolidMagicWand />}
          onClick={requestFix}
          data-test="fix-with-ai"
        >
          Fix with AI
        </Button>
      )}
    </Box>
  )
}

function AiErrorFixStatus() {
  const { failureMessage, phase, result } = useAiErrorFix()

  if (phase === 'loading') {
    return null
  }

  if (phase === 'failed') {
    return (
      <Text mt={2} textStyle="body-2" aria-live="polite">
        {failureMessage}
      </Text>
    )
  }

  if (result?.fixed) {
    return (
      <Text mt={2} textStyle="body-2" aria-live="polite">
        {result.summary} Check step again.
        {result.sources[0] && (
          <Button
            as="a"
            href={result.sources[0].url}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="link"
            ml={2}
          >
            Guide
          </Button>
        )}
      </Text>
    )
  }

  if (!result?.summary) {
    return null
  }

  return (
    <Text mt={2} textStyle="body-2" aria-live="polite">
      {result.summary}
    </Text>
  )
}

const AiErrorFix = {
  Action: AiErrorFixAction,
  Provider: AiErrorFixProvider,
  Status: AiErrorFixStatus,
}

export default AiErrorFix
