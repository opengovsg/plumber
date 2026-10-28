import { Flex, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

interface TemplateSectionProps {
  icon: ReactNode
  title: string
  count?: number
  badge?: ReactNode
  description?: string
  children: ReactNode
}

export default function TemplateSection({
  icon,
  title,
  count,
  badge,
  description,
  children,
}: TemplateSectionProps): JSX.Element {
  return (
    <Flex as="section" flexDir="column" rowGap={4} mb={10}>
      <Flex flexDir="column" rowGap={1}>
        <Flex alignItems="center" columnGap={2}>
          {icon}
          <Text textStyle="subhead-1" color="base.content.strong">
            {title}
          </Text>
          {badge}
          {count !== undefined && (
            <Text textStyle="caption-1" color="base.content.medium">
              {count}
            </Text>
          )}
        </Flex>
        {description && (
          <Text textStyle="body-2" color="base.content.medium" pl={7}>
            {description}
          </Text>
        )}
      </Flex>
      {children}
    </Flex>
  )
}
