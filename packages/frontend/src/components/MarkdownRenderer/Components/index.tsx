import { Components } from 'react-markdown'
import {
  Link,
  ListItem,
  OrderedList,
  SystemStyleObject,
  Text,
  UnorderedList,
} from '@chakra-ui/react'

// supports text, link and list styles
type MarkdownComponentStyles = {
  [componentType: string]: SystemStyleObject
}

export interface MarkdownComponentProps {
  styles?: MarkdownComponentStyles
}

export default function MarkdownComponent(props: MarkdownComponentProps) {
  const { styles = {} } = props
  // Define your custom Markdown styles using Chakra UI components
  const textStyles = {
    sx: {
      lineHeight: '1.5',
      ...(styles.text ?? {}),
    },
  }

  const linkStyles = {
    sx: {
      ...(styles.link ?? {}),
    },
  }

  const listStyles = {
    sx: {
      ...(styles.list ?? {}),
    },
  }

  const mdComponents: Components = {
    p: ({ ...props }) => <Text {...props} {...textStyles} />,
    ol: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <OrderedList {...newProps} {...listStyles} />
    },
    ul: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <UnorderedList {...newProps} {...listStyles} />
    },
    li: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <ListItem {...newProps} {...textStyles} />
    },
    a: ({ ...props }) => {
      const { href } = props
      const isExternal =
        (href && !href.startsWith(window.location.origin)) || false
      return <Link {...props} {...linkStyles} isExternal={isExternal} />
    },
  }
  return mdComponents
}
