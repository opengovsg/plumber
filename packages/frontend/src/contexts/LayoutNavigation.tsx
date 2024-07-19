import { createContext, ReactNode } from 'react'

import { DrawerLink } from '@/components/Layout'

export type LayoutNavigationProviderData = {
  links: DrawerLink[]
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

interface LayoutNavigationProviderProps {
  children: ReactNode
  value: LayoutNavigationProviderData
}

export const LayoutNavigationContext = createContext(
  {} as LayoutNavigationProviderData,
)

export function LayoutNavigationProvider(
  props: LayoutNavigationProviderProps,
): JSX.Element {
  const { children, value } = props
  return (
    <LayoutNavigationContext.Provider value={value}>
      {children}
    </LayoutNavigationContext.Provider>
  )
}
