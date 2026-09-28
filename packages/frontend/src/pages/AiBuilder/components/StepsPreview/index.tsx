import { IStepConfig } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { MdOpenInNew } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Box,
  Center,
  Flex,
  HStack,
  Image,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { CREATE_FLOW_WITH_STEPS } from '@/graphql/mutations/create-flow-with-steps'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import aiBuilderErrorImg from '@/pages/AiBuilder/assets/AiBuilderError.svg'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import PreviewItems from './PreviewItems'
import Step from './Step'

export default function StepsPreview() {
  const navigate = useNavigate()
  const {
    flowName,
    output,
    steps,
    triggerStep,
    previewItems,
    clearPersistedState,
  } = useAiBuilderContext()
  const { stepParametersByStepId, completedStepIds, activeStepId } =
    useStepConfigContext()

  const isMcpPipeMode = Boolean(output?.pipeId) // Phase 2b+: DB pipe exists
  const isMcpProposalMode = !isMcpPipeMode && Boolean(output?.mcpMode) // Phase 2a: proposal, no DB

  // Derive the active step as the first uncompleted step in order,
  // but advance past it if the AI has already moved on (e.g. after a step
  // failed and was skipped — the failed step stays uncompleted but the AI
  // is configuring a later one).
  const effectiveActiveStepId = useMemo(() => {
    if (!isMcpPipeMode || !output?.steps?.length) {
      return null
    }
    const steps: Array<{ id: string }> = output.steps
    const firstUncompleted = steps.find((s) => !completedStepIds.has(s.id))
    if (!firstUncompleted) {
      return null
    }
    // If the AI has sent an update for a step that comes after firstUncompleted
    // (skipped failure case), highlight that later step instead.
    if (activeStepId && activeStepId !== firstUncompleted.id) {
      const firstUncompletedIndex = steps.findIndex(
        (s) => s.id === firstUncompleted.id,
      )
      const activeIndex = steps.findIndex((s) => s.id === activeStepId)
      if (activeIndex > firstUncompletedIndex) {
        return activeStepId
      }
    }
    return firstUncompleted.id
  }, [isMcpPipeMode, output?.steps, completedStepIds, activeStepId])

  const [createFlowWithSteps, { loading: isCreatingFlow }] = useMutation(
    CREATE_FLOW_WITH_STEPS,
  )

  const onCreateFlowWithSteps = useCallback(async () => {
    const { data } = await createFlowWithSteps({
      variables: {
        input: {
          flowName: flowName || 'Name your Pipe',
          steps: steps?.map((step) => {
            const config: IStepConfig = {}
            if (step?.config?.stepName) {
              config['stepName'] = step.config.stepName
            }

            if (step?.description) {
              config['templateConfig'] = {
                customTemplate: step.description,
              }
            }

            return {
              type: step.type,
              appKey: step.appKey,
              key: step.key,
              config,
              // NOTE: we need to pass the parameters especially for if-then branches
              parameters: step?.parameters || {},
              position: step.position,
            }
          }),
          aiBuilderConfig: {
            traceId: output?.traceId,
          },
        },
      },
    })

    const flowId = data?.createFlowWithSteps?.id

    // Clear persisted draft state since we successfully created the flow
    clearPersistedState()

    navigate(URLS.FLOW_EDITOR(flowId), {
      replace: true,
    })
  }, [
    steps,
    createFlowWithSteps,
    flowName,
    navigate,
    output?.traceId,
    clearPersistedState,
  ])

  const hasNoContent = isMcpPipeMode
    ? !output?.steps?.length
    : output?.error || !steps || !(output?.trigger && output?.actions?.length)

  if (hasNoContent) {
    return (
      <Center h="80%">
        <Flex
          flexDir="column"
          alignItems="center"
          justifyContent="center"
          gap={4}
          w="100%"
          maxW="400px"
        >
          <Image src={aiBuilderErrorImg} alt="ai-builder-error" w="400px" />
          <Text textStyle="h4" fontWeight="normal">
            Something went wrong.
          </Text>
          {!isMcpPipeMode && output?.error && <Text>{output.error}</Text>}
          <Text>Modify your prompt and try again.</Text>
          <Text>
            If this issue persists,{' '}
            <a href={URLS.SUPPORT_FORM_LINK} target="_blank" rel="noreferrer">
              contact us
            </a>
            .
          </Text>
        </Flex>
      </Center>
    )
  }

  return (
    <>
      <Box
        opacity={
          !isMcpPipeMode && !isMcpProposalMode && isCreatingFlow ? 0.4 : 1
        }
        pos="relative"
        w="100%"
      >
        <Step
          step={triggerStep}
          {...(isMcpPipeMode && {
            isActive: triggerStep?.id === effectiveActiveStepId,
            isConfigured: Boolean(
              triggerStep?.id && completedStepIds.has(triggerStep.id),
            ),
            parameters: triggerStep?.id
              ? stepParametersByStepId[triggerStep.id]
              : undefined,
          })}
        />
        <PreviewItems
          items={previewItems}
          isNested={false}
          effectiveActiveStepId={effectiveActiveStepId}
        />
        <VStack mt={10} gap={2}>
          <HStack alignItems="center" justifyContent="center" gap={2}>
            {isMcpPipeMode ? (
              <Button
                variant="solid"
                size="sm"
                rightIcon={<MdOpenInNew />}
                onClick={() => {
                  window.open(
                    URLS.FLOW_EDITOR(output.pipeId),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }}
              >
                Open in editor
              </Button>
            ) : isMcpProposalMode ? null : (
              <Button variant="solid" onClick={onCreateFlowWithSteps} size="sm">
                Create this workflow
              </Button>
            )}
          </HStack>
        </VStack>
      </Box>
      {!isMcpPipeMode && !isMcpProposalMode && isCreatingFlow && (
        <Flex
          pos="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={10}
          flexDir="column"
          alignItems="center"
          justifyContent="center"
          gap={4}
        >
          <PrimarySpinner fontSize="4xl" thickness="4px" />
          <Text textStyle="h6">Creating workflow...</Text>
        </Flex>
      )}
    </>
  )
}
