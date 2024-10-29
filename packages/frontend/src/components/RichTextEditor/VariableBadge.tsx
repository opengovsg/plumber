import { Badge, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'
import { Node } from '@tiptap/pm/model'
import { NodeViewWrapper } from '@tiptap/react'

const PLACEHOLDER_TEMPLATE_STEP_ID = '00000000-0000-0000-0000-000000000000'

export const VariableBadge = ({ node }: { node: Node }) => {
  // this happens when there is no value mapped properly
  const isEmpty = node.attrs.value === '' || node.attrs.value == null
  const value = String(node.attrs.value)
  const isTemplate = String(node.attrs.id).includes(
    PLACEHOLDER_TEMPLATE_STEP_ID,
  )

  return (
    <NodeViewWrapper>
      {/* Only show tooltip if value is empty and not a template */}
      <TouchableTooltip
        label={
          isEmpty && !isTemplate
            ? 'Data is missing for this variable, please test previous steps and reselect the variable'
            : ''
        }
        aria-label="variable badge tooltip"
      >
        <Badge
          maxW="full"
          variant="solid"
          borderRadius="50px"
          mx={0.5}
          cursor="default"
          bg={isEmpty ? 'transparent' : 'primary.100'}
          borderStyle={isEmpty ? 'dashed' : 'solid'}
          borderWidth={isEmpty ? '2px' : '0px'}
          borderColor={isEmpty ? 'primary.600' : 'transparent'}
          data-content={isEmpty ? 'empty' : 'filled'}
        >
          <Text
            isTruncated
            color="base.content.strong"
            mr={isEmpty ? undefined : '0.25rem'}
          >
            {node.attrs.label}
          </Text>
          {!isEmpty && (
            <Text isTruncated maxW="50ch" color="base.content.medium">
              {value}
            </Text>
          )}
        </Badge>
      </TouchableTooltip>
    </NodeViewWrapper>
  )
}
