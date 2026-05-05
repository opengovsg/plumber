import { useContext } from 'react'
import { Badge, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'
import { Node } from '@tiptap/pm/model'
import { NodeViewWrapper } from '@tiptap/react'

import { EditorContext } from '@/contexts/Editor'
import { POPOVER_OPACITY_MOTION_PROPS } from '@/theme/constants'

const PLACEHOLDER_TEMPLATE_STEP_ID = '00000000-0000-0000-0000-000000000000'

export const VariableBadge = ({ node }: { node: Node }) => {
  const { stepsWithVars } = useContext(EditorContext)
  // this happens when there is no value mapped properly
  const isEmpty = node.attrs.value === '' || node.attrs.value == null
  const value = String(node.attrs.value)
  const isTemplate = String(node.attrs.id).includes(
    PLACEHOLDER_TEMPLATE_STEP_ID,
  )

  const stepId = node.attrs.id?.startsWith('step.')
    ? node.attrs.id.split('.')[1]
    : null
  const step = stepsWithVars.find((step) => step.id === stepId)

  return (
    <NodeViewWrapper>
      {/* Only show tooltip if value is empty and not a template */}
      <TouchableTooltip
        motionProps={POPOVER_OPACITY_MOTION_PROPS}
        label={
          isEmpty && !isTemplate
            ? 'This is a missing variable, check your previous steps and reselect a variable'
            : step?.name
        }
        aria-label="variable badge tooltip"
      >
        <Badge
          maxW="full"
          variant="solid"
          borderRadius="50px"
          mx={0.5}
          px={3}
          py={1}
          cursor="default"
          bg={isEmpty ? 'transparent' : 'primary.100'}
          borderStyle={isEmpty ? 'dashed' : 'solid'}
          borderWidth={isEmpty ? '2px' : '0px'}
          borderColor={isEmpty ? 'primary.600' : 'transparent'}
          data-content={isEmpty ? 'empty' : 'filled'}
          fontSize="sm"
        >
          <Text
            isTruncated
            maxW={isTemplate ? 'full' : '20ch'}
            color="base.content.strong"
            mr={isEmpty ? undefined : '0.25rem'}
          >
            {node.attrs.label}
          </Text>
          {!isEmpty && (
            <Text isTruncated maxW="40ch" color="base.content.medium">
              {value}
            </Text>
          )}
        </Badge>
      </TouchableTooltip>
    </NodeViewWrapper>
  )
}
