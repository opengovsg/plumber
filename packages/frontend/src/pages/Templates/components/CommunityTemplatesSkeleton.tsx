import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface CommunityTemplatesSkeletonProps {
  count?: number
  onTurnOn: () => void
}

export default function CommunityTemplatesSkeleton({
  count,
  onTurnOn,
}: CommunityTemplatesSkeletonProps): JSX.Element {
  const subject =
    count === undefined
      ? 'Templates'
      : `${count} template${count === 1 ? '' : 's'}`

  return (
    <Flex
      alignItems="center"
      columnGap={4}
      rowGap={3}
      flexWrap="wrap"
      px={6}
      py={5}
      mb={10}
      border="1px dashed"
      borderColor="base.divider.strong"
      borderRadius="md"
    >
      <Icon
        viewBox="0 0 24 24"
        boxSize="22px"
        flexShrink={0}
        color="interaction.sub.default"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      >
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" />
      </Icon>
      <Flex flexDir="column" rowGap={1} flex={1} minW="12rem">
        <Flex alignItems="center" columnGap={2}>
          <Text
            fontSize="15px"
            lineHeight="18px"
            fontWeight={600}
            color="base.content.strong"
          >
            Community templates
          </Text>
          <Box
            px="7px"
            py="1px"
            borderRadius="10px"
            bg="#FFF3D6"
            border="1px solid"
            borderColor="#F2D58A"
          >
            <Text
              fontSize="10px"
              lineHeight="12px"
              letterSpacing="0.04em"
              fontWeight={600}
              color="#7A5600"
            >
              BETA
            </Text>
          </Box>
        </Flex>
        <Text fontSize="13px" lineHeight="19px" color="base.content.default">
          {subject} shared by other public officers. Turn on to browse them and
          share your own.
        </Text>
      </Flex>
      <Button variant="outline" size="xs" flexShrink={0} onClick={onTurnOn}>
        Turn on
      </Button>
    </Flex>
  )
}
