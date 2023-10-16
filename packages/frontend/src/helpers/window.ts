// Helper function to get origin from window.opener
// try catch need since opener.location will throw error if opener is from different origin
export function getOpenerOrigin(): string | undefined {
  const opener = window.opener
  if (opener) {
    try {
      return opener.location.origin
    } catch (error) {
      console.error(error)
    }
  }
  return undefined
}
