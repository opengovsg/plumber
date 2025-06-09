import { Box } from '@chakra-ui/react'

import AppIcon from '@/components/AppIcon'

interface AppIconWithStatusProps {
  iconUrl: string
  appName: string
  statusIcon: React.ReactElement
}

export default function AppIconWithStatus({
  iconUrl,
  appName,
  statusIcon,
}: AppIconWithStatusProps): React.ReactElement {
  return (
    <Box position="relative">
      <AppIcon url={iconUrl} name={appName} />
      <Box
        position="absolute"
        right="0"
        top="0"
        transform="translate(50%, -50%)"
        display="inline-flex"
        sx={{
          svg: {
            // to make it distinguishable over an app icon
            background: 'white',
            borderRadius: '100%',
            overflow: 'hidden',
          },
        }}
      >
        {statusIcon}
      </Box>
    </Box>
  )
}
