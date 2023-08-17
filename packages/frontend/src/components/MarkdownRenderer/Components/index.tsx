import { BiLinkExternal } from 'react-icons/bi'
import { Components } from 'react-markdown'
import {
  forwardRef,
  Icon,
  Link,
  LinkProps,
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

  const ExternalIcon = (): JSX.Element => {
    return <Icon as={BiLinkExternal} verticalAlign="middle" ml="0.25rem" />
  }

  // differentiates between an internal and external link when displaying
  const CustomLink = forwardRef<LinkProps, 'a'>(
    ({ children: content, isExternal, ...props }, ref) => {
      return (
        <Link ref={ref} {...props}>
          {content}
          {isExternal && <ExternalIcon />}
        </Link>
      )
    },
  )

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
      return (
        <CustomLink
          isExternal={isExternal}
          {...props}
          {...linkStyles}
        ></CustomLink>
      )
    },
  }
  return mdComponents
}
