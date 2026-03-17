import { createIcon } from '@chakra-ui/react'

export const BrokenPipeIcon = createIcon({
  displayName: 'BrokenPipeIcon',
  viewBox: '0 0 64 64',
  defaultProps: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.5',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  },
  path: (
    <>
      {/* Left coupling */}
      <rect x="4" y="18" width="8" height="24" rx="2" />
      {/* Left pipe body - top and bottom lines only, broken at crack */}
      <line x1="12" y1="22" x2="27" y2="22" />
      <line x1="12" y1="38" x2="27" y2="38" />

      {/* Right coupling */}
      <rect x="52" y="18" width="8" height="24" rx="2" />
      {/* Right pipe body - top and bottom lines */}
      <line x1="37" y1="22" x2="52" y2="22" />
      <line x1="35" y1="38" x2="52" y2="38" />

      {/* Crack - jagged line from top of pipe downward through bottom */}
      <path d="M27,22 L30,27 L26,30 L31,34 L28,38" />
      <path d="M37,22 L34,27 L38,30 L33,34 L35,38" />

      {/* Water droplet - rounded bottom, pointed top */}
      <path
        d="M32,43 C32,43 28,50 28,53 A4,4 0 0,0 36,53 C36,50 32,43 32,43 Z"
        fill="currentColor"
        stroke="currentColor"
      />
    </>
  ),
})
