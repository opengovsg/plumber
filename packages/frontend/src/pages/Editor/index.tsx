import EditorLayout from '@/components/EditorLayout'
import RedirectToLogin from '@/components/RedirectToLogin'
import useAuthentication from '@/hooks/useAuthentication'

export default function FlowEditor(): React.ReactElement {
  const { currentUser } = useAuthentication()

  if (!currentUser) {
    return <RedirectToLogin />
  }
  return <EditorLayout />
}
