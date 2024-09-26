import type { Components } from 'react-markdown'
import { chakra } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'

export const infoboxMdComponents: Components = {
  // Force all links in our message to be opened in a new tab.
  a: ({ ...props }) => (
    <Link
      isExternal
      color="interaction.links.neutral-default"
      _hover={{ color: 'interaction.links.neutral-hover' }}
      {...props}
    />
  ),
  // react-markdown wraps everything in a <Text> by default,
  // which mucks up styling for infoboxes with variants.
  p: ({ ...props }) => <chakra.p {...props} />,
}
