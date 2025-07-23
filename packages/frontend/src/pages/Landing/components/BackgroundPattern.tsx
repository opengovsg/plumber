import { Box, chakra } from '@chakra-ui/react'

export default function BackgroundPattern() {
  return (
    <Box
      as="svg"
      position="fixed"
      inset="0"
      zIndex="-2"
      width="100%"
      height="100%"
      stroke="gray.200"
      aria-hidden="true"
      __css={{
        maskImage:
          'radial-gradient(100% 100% at top right, white, transparent)',
        WebkitMaskImage:
          'radial-gradient(100% 100% at top right, white, transparent)', // Safari fallback
      }}
    >
      <defs>
        <pattern
          id="grid-pattern"
          x="50%"
          y="-1"
          width="200"
          height="200"
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 200V.5H200" fill="none" />
        </pattern>
      </defs>
      <chakra.rect
        fill="url(#grid-pattern)"
        width="100%"
        height="100%"
        strokeWidth={0}
      />
    </Box>
  )
}
