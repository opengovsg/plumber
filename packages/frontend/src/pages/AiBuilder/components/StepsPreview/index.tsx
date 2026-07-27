import { IStepConfig } from '@plumber/types'

import { Fragment, useCallback, useMemo } from 'react'
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
import { Button, useIsMobile } from '@opengovsg/design-system-react'

import Error from '@/components/FlowStepGroup/Content/Error'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { CREATE_FLOW_WITH_STEPS } from '@/graphql/mutations/create-flow-with-steps'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import aiBuilderErrorImg from '@/pages/AiBuilder/assets/AiBuilderError.svg'

import BranchStep from './BranchStep'
import GroupedStepContainer from './GroupedStepContainer'
import Step from './Step'

export default function StepsPreview() {
  const navigate = useNavigate()
  const {
    flowName,
    output,
    steps,
    triggerStep,
    actionSteps,
    stepsBeforeGroup,
    groupedSteps,
    stepGroupType,
    stepGroupCaption,
    clearPersistedState,
  } = useAiBuilderContext()

  const isMobile = useIsMobile()

  const isMcpPipeMode = Boolean(output?.pipeId) // Phase 2b+: DB pipe exists
  const isMcpProposalMode = !isMcpPipeMode && Boolean(output?.mcpMode) // Phase 2a: proposal, no DB

  const [createFlowWithSteps, { loading: isCreatingFlow }] = useMutation(
    CREATE_FLOW_WITH_STEPS,
  )

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
            ) : isMcpProposalMode ? (
              <Text textStyle="body-2" color="base.content.medium">
                Reply in chat to confirm and build this pipe
              </Text>
            ) : (
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
