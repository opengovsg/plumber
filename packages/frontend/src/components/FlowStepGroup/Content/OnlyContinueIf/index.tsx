import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiSolidErrorCircle } from 'react-icons/bi'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'
import DeleteStepButton from '@/components/FlowStep/components/DeleteStepButton'
import DuplicateStepButton from '@/components/FlowStep/components/DuplicateStepButton'
import FlowStepWrapper from '@/components/FlowStep/FlowStepWrapper'
import { DragHandle } from '@/components/SortableList/components'
import { NESTED_DRAG_HANDLE_WIDTH } from '@/components/SortableList/components/SortableItem'
import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import ConditionBlockHeader from '../../components/ConditionBlockHeader'
import { getConditionBlockPreviewParts } from '../../helpers/getConditionBlockPreview'
import { conditionBlockStyles } from '../IfThen/styles'

interface OnlyContinueIfProps {
  step: IStep
  isNested?: boolean
  allowReorder?: boolean
  canChildStepsReorder?: boolean
  /** When true, omit the caption — nothing follows this step to gate. */
  isLastStep?: boolean
}

/**
 * An only-continue-if step drawn like the IF / REPEAT condition headers: a
 * CONTINUE IF badge and a live condition preview. Unlike those two it holds no
 * steps — the ones it gates are its siblings below — so a caption under the
 * card spells out that a failed check stops the flow there.
 */
export default function OnlyContinueIf({
  step,
  isNested = false,
  allowReorder = true,
  canChildStepsReorder = false,
  isLastStep = false,
}: OnlyContinueIfProps): JSX.Element {
  const { currentStepId, isDrawerOpen, isMobile, readOnly } =
    useContext(EditorContext)
  const {
    displayPosition,
    isDeletable,
    shouldShowDragHandle,
    stepName,
    warnsMrfNoGate,
  } = useStepMetadata(step, allowReorder)

  const {
    cancelRef,
    isWarningOpen,
    onWarningOpen,
    onWarningClose,
    handleLeave: discardChanges,
  } = useUnsavedChanges({
    onProceed: () => undefined,
  })

  const isSelected = currentStepId === step.id
  const headerWidth = getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)
  const nestedHandleOffset =
    isNested && shouldShowDragHandle ? NESTED_DRAG_HANDLE_WIDTH / 2 : 0

  const previewParts = useMemo(
    () => getConditionBlockPreviewParts(step.parameters),
    [step.parameters],
  )

  return (
    <FlowStepWrapper
      canChildStepsReorder={canChildStepsReorder}
      allowReorder={allowReorder}
      isDrawerOpen={isDrawerOpen}
      isReadOnly={readOnly}
    >
      <Flex flexDir="column" w="100%" alignItems="center">
        <Flex
          pos="relative"
          alignItems="center"
          w={headerWidth}
          minW={MIN_FLOW_STEP_WIDTH}
          flexDir="column"
        >
          {warnsMrfNoGate && (
            <Box
              borderColor={
                isSelected ? 'base.content.brand' : 'base.divider.medium'
              }
              borderRadius="lg"
              borderWidth="1px"
              borderBottomRadius="none"
              borderBottomWidth={0}
              w="100%"
              overflow="hidden"
            >
              <Infobox
                icon={<BiSolidErrorCircle />}
                variant="warning"
                style={{
                  borderBottomLeftRadius: '0',
                  borderBottomRightRadius: '0',
                }}
              >
                This won&rsquo;t stop the next respondent. FormSG still sends
                them the form. &ldquo;Only continue if&rdquo; only skips the
                Plumber steps below.
              </Infobox>
            </Box>
          )}
          <Flex w="100%" alignItems="center" pos="relative">
            <Flex
              {...conditionBlockStyles.container}
              display={isMobile ? 'block' : 'flex'}
              flex={nestedHandleOffset ? undefined : '1'}
              flexShrink={nestedHandleOffset ? 0 : undefined}
              w={
                nestedHandleOffset
                  ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
                  : undefined
              }
              ml={nestedHandleOffset ? `${nestedHandleOffset}px` : undefined}
              minW="0"
              overflow="hidden"
              borderWidth="1px"
              borderTopWidth={warnsMrfNoGate ? 0 : '1px'}
              borderColor={
                isSelected ? 'base.content.brand' : 'base.divider.medium'
              }
              borderTopRadius={warnsMrfNoGate ? 'none' : 'lg'}
            >
              <ConditionBlockHeader
                badgeLabel="CONTINUE IF"
                previewParts={previewParts}
                stepId={step.id}
                isSelected={isSelected}
                actions={
                  isDeletable && !readOnly ? (
                    <>
                      <DuplicateStepButton
                        alwaysVisible
                        isNested={isNested}
                        step={step}
                      />
                      <DeleteStepButton
                        alwaysVisible
                        isNested={isNested}
                        step={step}
                        displayPosition={displayPosition}
                        stepName={stepName}
                      />
                    </>
                  ) : undefined
                }
              />
            </Flex>
            {shouldShowDragHandle &&
              (isNested ? (
                <DragHandle isNested={isNested} onWarningOpen={onWarningOpen} />
              ) : (
                <Box position="absolute" left="100%" alignSelf="center">
                  <DragHandle onWarningOpen={onWarningOpen} />
                </Box>
              ))}
          </Flex>
        </Flex>

        {!isLastStep && (
          <Text
            mt={3}
            mb={1}
            textAlign="center"
            fontSize="0.6875rem"
            lineHeight="0.875rem"
            letterSpacing="0.03em"
            textTransform="uppercase"
            fontWeight="500"
            color="base.divider.strong"
          >
            Otherwise flow stops here
          </Text>
        )}
      </Flex>

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={discardChanges}
      />
    </FlowStepWrapper>
  )
}
