import { Badge, Image, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'
import { Node } from '@tiptap/pm/model'
import { NodeViewWrapper } from '@tiptap/react'
import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { POPOVER_OPACITY_MOTION_PROPS } from '@/theme/constants'

import { RichTextEditorContext } from './RichTextEditorContext'

const PLACEHOLDER_TEMPLATE_STEP_ID = '00000000-0000-0000-0000-000000000000'

export const VariableBadge = ({ node }: { node: Node }) => {
  const { stepsWithVars } = useContext(EditorContext)
  const { getVariableStepName } = useContext(RichTextEditorContext)
  // this happens when there is no value mapped properly
  const isEmpty = node.attrs.value === '' || node.attrs.value == null
  const value = String(node.attrs.value)
  const isTemplate = String(node.attrs.id).includes(
    PLACEHOLDER_TEMPLATE_STEP_ID,
  )

  const stepId = node.attrs.id?.startsWith('step.')
    ? node.attrs.id.split('.')[1]
    : null
  const sourceStep = stepsWithVars.find((step) => step.id === stepId)
  const stepName = getVariableStepName?.(node.attrs.id) ?? sourceStep?.name
  // The source app's logo marks where the data comes from.
  const logoUrl = !isEmpty ? sourceStep?.iconUrl : null

  return (
    <NodeViewWrapper>
      {/* Only show tooltip if value is empty and not a template */}
      <TouchableTooltip
        motionProps={POPOVER_OPACITY_MOTION_PROPS}
        label={
          isEmpty && !isTemplate
            ? 'This is a missing variable, check your previous steps and reselect a variable'
            : stepName
        }
        aria-label="variable badge tooltip"
      >
        <Badge
          maxW="full"
          variant="solid"
          borderRadius="50px"
          mx={0.5}
          display="inline-flex"
          alignItems="center"
          pl={logoUrl ? 2.5 : 3}
          pr={3}
          py={1}
          cursor="default"
          bg={isEmpty ? 'transparent' : '#EDEDED'}
          borderStyle={isEmpty ? 'dashed' : 'solid'}
          borderWidth={isEmpty ? '2px' : '0px'}
          borderColor={isEmpty ? 'base.divider.strong' : 'transparent'}
          data-content={isEmpty ? 'empty' : 'filled'}
          fontSize="sm"
        >
          {logoUrl && (
            <Image
              src={logoUrl}
              alt=""
              boxSize="14px"
              flexShrink={0}
              mr={1.5}
              borderRadius="2px"
              fallbackStrategy="onError"
              fallback={<></>}
            />
          )}
          <Text
            isTruncated
            maxW={isTemplate ? 'full' : '20ch'}
            fontWeight={400}
            color="base.content.strong"
            mr={isEmpty ? undefined : '0.25rem'}
          >
            {node.attrs.label}
          </Text>
          {!isEmpty && (
            <Text
              isTruncated
              maxW="40ch"
              fontWeight={400}
              color="base.content.medium"
            >
              {value}
            </Text>
          )}
        </Badge>
      </TouchableTooltip>
    </NodeViewWrapper>
  )
}
