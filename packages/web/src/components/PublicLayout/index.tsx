import { Box } from '@mui/material'
import SiteWideBanner from 'components/SiteWideBanner'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  return (
    <>
      <SiteWideBanner />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {children}
      </Box>
    </>
  )
}
