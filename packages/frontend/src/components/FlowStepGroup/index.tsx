import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiTrash } from 'react-icons/bi'
import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import { NESTED_DRAG_HANDLE_WIDTH } from '@/components/SortableList/components/SortableItem'
import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth, getToolboxIcon } from '@/helpers/editor'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'

import { MIN_FLOW_STEP_WIDTH } from '../Editor/constants'

import DeleteConfirmationDialog from './components/DeleteConfirmationDialog'
import Error from './Content/Error'
import ForEach from './Content/ForEach'
import ForEachV1 from './Content/ForEach/ForEachV1'
import IfThenV1 from './Content/IfThen/IfThenV1'
import useDeleteStepConfirmation from './hooks/useDeleteStepConfirmation'
import { flowStepGroupStyles } from './styles'

interface FlowStepGroupProps {
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export default function FlowStepGroup(props: FlowStepGroupProps) {
  const { groupedSteps, stepsBeforeGroup } = props
  const { isDrawerOpen, isMobile, onDrawerClose, readOnly } =
    useContext(EditorContext)
  const { isEnabled: isIfThenV2Enabled } = useIfThenV2Enabled()

  const { stepGroupType, stepGroupCaption } = useMemo(() => {
    let stepGroupType: string | null = null
    let stepGroupCaption: string | null = null

    const groupKey = groupedSteps[0]?.[0]?.key
    if (!groupKey) {
      return { stepGroupType: null, stepGroupCaption: null }
    }

    if (groupKey === TOOLBOX_ACTIONS.IfThen) {
      stepGroupType = TOOLBOX_ACTIONS.IfThen
      stepGroupCaption = 'If-then'
    }

    if (groupKey === TOOLBOX_ACTIONS.ForEach) {
      stepGroupType = TOOLBOX_ACTIONS.ForEach
      stepGroupCaption = 'For each'
    }

    return { stepGroupType, stepGroupCaption }
  }, [groupedSteps])

  const {
    isOpen: isDeleteConfirmationOpen,
    onOpen: openDeleteConfirmation,
    onClose: closeDeleteConfirmation,
    onDelete: deleteForEach,
    cancelRef,
  } = useDeleteStepConfirmation(stepGroupType ?? '', groupedSteps)

  const handleForEachDelete = useCallback(async () => {
    await deleteForEach()
    onDrawerClose()
  }, [deleteForEach, onDrawerClose])

  // NOTE: we check if its inside the for-each
  // so that if-then steps follow the same width of the nested actions
  // when the drag handle is shown
  const isInsideForEach = stepsBeforeGroup.some(
    (step) => step.key === TOOLBOX_ACTIONS.ForEach,
  )

  const outerWidth =
    isInsideForEach && stepsBeforeGroup.length > 2 && !isDrawerOpen
      ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
      : '100%'

  const widthSlot = {
    display: isMobile ? 'block' : 'flex',
    w: getFlowStepHeaderWidth(isDrawerOpen, isMobile),
    minW: MIN_FLOW_STEP_WIDTH,
  }

  /**
   * A for-each V2 draws its own REPEAT-badge card and delete button, so it
   * takes a bare width slot instead of the chrome below.
   *
   * IMPORTANT: that chrome, `ForEachV1` and this fork all go once the flag
   * retires.
   */
  if (stepGroupType === TOOLBOX_ACTIONS.ForEach && isIfThenV2Enabled) {
    return (
      <Flex
        w={outerWidth}
        alignItems="center"
        justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
      >
        <Flex {...widthSlot}>
          <ForEach
            groupedSteps={groupedSteps}
            stepsBeforeGroup={stepsBeforeGroup}
          />
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex
      w={outerWidth}
      alignItems="center"
      justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
    >
      <Flex {...flowStepGroupStyles.container} {...widthSlot}>
        <Box {...flowStepGroupStyles.header} w="100%">
          <Flex
            px={4}
            pt={4}
            alignItems="center"
            borderRadius="inherit"
            w="full"
            borderLeftWidth={0}
            borderRightWidth={0}
            role="group"
          >
            <Flex {...flowStepGroupStyles.iconWrapper}>
              {/* App icon */}
              <Icon
                boxSize={8}
                as={getToolboxIcon(stepGroupType)}
                color="primary.500"
              />
            </Flex>
            <Flex direction="column" align="start">
              <Flex alignItems="center" gap={2}>
                <Text textStyle="subhead-1" color="base.content.default">
                  {stepGroupCaption}
                </Text>
              </Flex>
            </Flex>
            {stepGroupType === TOOLBOX_ACTIONS.ForEach && !readOnly && (
              <Flex ml="auto" opacity={0} _groupHover={{ opacity: 1 }}>
                <IconButton
                  boxSize={8}
                  variant="clear"
                  aria-label="Delete for each action"
                  icon={<BiTrash />}
                  colorScheme="secondary"
                  onClick={openDeleteConfirmation}
                />
              </Flex>
            )}
          </Flex>
        </Box>
        {stepGroupType === TOOLBOX_ACTIONS.IfThen ? (
          <IfThenV1
            groupedSteps={groupedSteps}
            stepsBeforeGroup={stepsBeforeGroup}
          />
        ) : stepGroupType === TOOLBOX_ACTIONS.ForEach ? (
          <>
            <ForEachV1
              groupedSteps={groupedSteps}
              stepsBeforeGroup={stepsBeforeGroup}
            />
            <DeleteConfirmationDialog
              name="For each"
              cancelRef={cancelRef}
              isOpen={isDeleteConfirmationOpen}
              onClose={closeDeleteConfirmation}
              onDelete={handleForEachDelete}
              onCancel={closeDeleteConfirmation}
            />
          </>
        ) : (
          <Error />
        )}
      </Flex>
    </Flex>
  )
}
