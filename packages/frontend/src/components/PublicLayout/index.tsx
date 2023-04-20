import { Box } from '@mui/material'
import { Masthead } from 'components/Masthead'
import SiteWideBanner from 'components/SiteWideBanner'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  return (
    <>
      <SiteWideBanner />
      <Masthead />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {children}
      </Box>
    </>
  )
}
