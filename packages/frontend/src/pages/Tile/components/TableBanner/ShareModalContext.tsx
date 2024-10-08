import { createContext, ReactNode, useContext, useState } from 'react'

interface ShareModalContextProps {
  onClose: () => void
  emailToTransfer: string | null
  setEmailToTransfer: (email: string | null) => void
}

const ShareModalContext = createContext<ShareModalContextProps | null>(null)

export const useShareModalContext = () => {
  const context = useContext(ShareModalContext)
  if (!context) {
    throw new Error(
      'useShareModalContext must be used within a ShareModalContextProvider',
    )
  }
  return context
}

interface ShareModalContextProviderProps {
  onClose: () => void
  children: ReactNode
}

export const ShareModalContextProvider = ({
  onClose,
  children,
}: ShareModalContextProviderProps) => {
  const [emailToTransfer, setEmailToTransfer] = useState<string | null>(null)

  return (
    <ShareModalContext.Provider
      value={{
        onClose,
        emailToTransfer,
        setEmailToTransfer,
      }}
    >
      {children}
    </ShareModalContext.Provider>
  )
}
