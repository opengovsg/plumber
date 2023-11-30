import { Badge, Text } from '@chakra-ui/react'
import { Node } from '@tiptap/pm/model'
import { NodeViewWrapper } from '@tiptap/react'

export const VariableBadge = ({ node }: { node: Node }) => {
  return (
    <NodeViewWrapper>
      <Badge maxW="full" variant="solid" bg="primary.100" borderRadius="50px">
        <Text isTruncated color="base.content.strong" mr={1}>
          {node.attrs.label}
        </Text>
        {node.attrs.value && (
          <Text isTruncated maxW="50ch" color="base.content.medium">
            {node.attrs.value}
          </Text>
        )}
      </Badge>
    </NodeViewWrapper>
  )
}
