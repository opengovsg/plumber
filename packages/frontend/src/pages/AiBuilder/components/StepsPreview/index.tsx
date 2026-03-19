import { IStepConfig } from '@plumber/types'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { Button, useIsMobile } from '@opengovsg/design-system-react'

import Error from '@/components/FlowStepGroup/Content/Error'
import { MultiStepLoader } from '@/components/MultiStepLoader'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { CREATE_FLOW_WITH_STEPS } from '@/graphql/mutations/create-flow-with-steps'
import { GENERATE_AI_STEPS } from '@/graphql/mutations/generate-ai-steps'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import aiBuilderErrorImg from '@/pages/AiBuilder/assets/AiBuilderError.svg'

import BranchStep from './BranchStep'
import GroupedStepContainer from './GroupedStepContainer'
import Step from './Step'

const LOADING_STATES = [
  { text: 'Thinking...' },
  { text: 'Setting up your steps' },
  { text: 'Writing descriptions for each step' },
  { text: 'Putting it all together...' },
]

interface StepsPreviewProps {
  isReadyForPreview: boolean
}

export default function StepsPreview({ isReadyForPreview }: StepsPreviewProps) {
  const location = useLocation()
  const {
    flowName,
    chatInput,
    output,
    steps,
    triggerStep,
    actionSteps,
    stepsBeforeGroup,
    groupedSteps,
    stepGroupType,
    stepGroupCaption,
    ddSessionId,
  } = useAiBuilderContext()

  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [error, setError] = useState<boolean>(false)

  const [createFlowWithSteps, { loading: isCreatingFlow }] = useMutation(
    CREATE_FLOW_WITH_STEPS,
  )
  const [generateAiStepsMutation, { loading: isGeneratingSteps }] =
    useMutation(GENERATE_AI_STEPS)

  const generateAiSteps = useCallback(
    async (prompt: string) => {
      // GUARD: skip the call altogether if the prompt is empty
      if (!prompt) {
        setError(true)
        return
      }

      try {
        setError(false)
        const { data } = await generateAiStepsMutation({
          variables: {
            input: {
              prompt,
              sessionId: ddSessionId,
            },
          },
        })
        return data?.generateAiSteps
      } catch {
        setError(true)
      }
    },
    [generateAiStepsMutation, ddSessionId],
  )

  const onGenerateAiSteps = useCallback(async () => {
    const prompt = chatInput
    const aiSteps = await generateAiSteps(prompt)

    navigate(location.pathname, {
      state: {
        ...location.state,
        output: aiSteps,
      },
      replace: true, // Use replace to avoid adding to history
    })

    // NOTE: we don't need to include the location.state in the dependencies
    // as we don't want to re-run the function if the location state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatInput, generateAiSteps, navigate, location.pathname])

  useEffect(() => {
    if (output || !isReadyForPreview) {
      return
    }
    onGenerateAiSteps()
  }, [onGenerateAiSteps, output, isReadyForPreview])

  const retryGenerateAiSteps = useCallback(async () => {
    setError(false)
    await generateAiSteps(chatInput)
  }, [generateAiSteps, chatInput])

  /** FOR EACH STEPS COMPUTATION */
  const forEachSteps = groupedSteps[0]
  const ifThenSteps = useMemo(() => {
    if (groupedSteps.length === 1) {
      return []
    }
    return groupedSteps.slice(1)
  }, [groupedSteps])

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

    navigate(URLS.FLOW_EDITOR(flowId), {
      replace: true,
    })
  }, [steps, createFlowWithSteps, flowName, navigate, output?.traceId])

  if (error || !steps) {
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
          <Image src={aiBuilderErrorImg} alt="ai-bulilder-error" w="400px" />
          <Text textStyle="h4" fontWeight="normal">
            Something went wrong.
          </Text>
          <Text>Modify your prompt or try again.</Text>
          <Text>
            If this issue persists,{' '}
            <a href={URLS.SUPPORT_FORM_LINK} target="_blank" rel="noreferrer">
              contact us
            </a>
            .
          </Text>
          <Button onClick={retryGenerateAiSteps}>Try again</Button>
        </Flex>
      </Center>
    )
  }

  if (isGeneratingSteps) {
    return (
      <Center h="100%">
        <MultiStepLoader
          loadingStates={LOADING_STATES}
          loading={isGeneratingSteps}
          duration={1500}
          loop={false}
        />
      </Center>
    )
  }

  return (
    <>
      <Box opacity={isCreatingFlow ? 0.4 : 1} pos="relative" w="100%">
        <Step step={triggerStep} />
        {stepsBeforeGroup.map((action) => (
          <Fragment key={`${action.position}-${action.appKey}`}>
            <Step
              key={`${action.position}-${action.appKey}`}
              step={action}
              isLastStep={action.position === actionSteps.length + 1}
            />
          </Fragment>
        ))}
        {groupedSteps.length > 0 && (
          <GroupedStepContainer
            stepGroupType={stepGroupType as string}
            stepGroupCaption={stepGroupCaption as string}
            isNested={false}
          >
            {stepGroupType === TOOLBOX_ACTIONS.IfThen ? (
              <Flex flexDir="column" w="100%" px={2} gap={4} mt={2}>
                {groupedSteps.map((branchSteps) => (
                  <BranchStep
                    key={String(branchSteps[0].position)}
                    branchSteps={branchSteps}
                    isMobile={isMobile}
                  />
                ))}
              </Flex>
            ) : stepGroupType === TOOLBOX_ACTIONS.ForEach ? (
              <Box w="100%">
                <Flex flexDir="column" w="100%" px={4} py={3}>
                  {forEachSteps.map((step, index) => (
                    <Step
                      key={String(step.position)}
                      step={step}
                      isNested={true}
                      isLastStep={
                        forEachSteps.length - 1 === index &&
                        ifThenSteps.length === 0
                      }
                    />
                  ))}
                  {ifThenSteps.length > 0 && (
                    <GroupedStepContainer
                      stepGroupType={TOOLBOX_ACTIONS.IfThen}
                      stepGroupCaption="If-then"
                      isNested={true}
                    >
                      <Flex flexDir="column" w="100%" px={2} gap={4} mt={2}>
                        {ifThenSteps.map((branchSteps) => (
                          <BranchStep
                            key={String(branchSteps[0].position)}
                            branchSteps={branchSteps}
                            isMobile={isMobile}
                          />
                        ))}
                      </Flex>
                    </GroupedStepContainer>
                  )}
                </Flex>
              </Box>
            ) : (
              <Error />
            )}
          </GroupedStepContainer>
        )}
        <VStack mt={10} gap={2}>
          <Text textStyle="body-1">Looks good?</Text>
          <HStack alignItems="center" justifyContent="center" gap={2}>
            <Button variant="solid" onClick={onCreateFlowWithSteps}>
              Create this workflow
            </Button>
          </HStack>
        </VStack>
      </Box>
      {isCreatingFlow && (
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
