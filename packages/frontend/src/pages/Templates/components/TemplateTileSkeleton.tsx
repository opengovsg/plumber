import { Box, Flex, Skeleton } from '@chakra-ui/react'
import { Tile } from '@opengovsg/design-system-react'

export default function TemplateTileSkeleton(): JSX.Element {
  return (
    <Tile
      icon={() => (
        <Box py={2}>
          <Skeleton height="2rem" width="2rem" borderRadius="md" />
        </Box>
      )}
      display="flex"
    >
      <Flex flexDir="column" gap={2} mt={2} width="full">
        <Skeleton height="1.5rem" width="80%" />
        <Skeleton height="1rem" width="100%" />
        <Skeleton height="1rem" width="60%" />
      </Flex>
    </Tile>
  )
}
