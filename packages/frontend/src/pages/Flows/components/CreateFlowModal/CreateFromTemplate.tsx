import type { ITemplate } from '@plumber/types'
import { useState } from 'react'

import { useApps } from '@/hooks/useApps'
import TemplatePreview from '@/pages/Template/components/TemplatePreview'
import { useTemplateBrowser } from '@/pages/Templates/hooks/useTemplateBrowser'

import TemplatePicker from './TemplatePicker'

interface CreateFromTemplateProps {
  onBack: () => void
  onDismiss: () => void
}

export default function CreateFromTemplate(props: CreateFromTemplateProps) {
  const { onBack, onDismiss } = props
  // Lives here so the search survives a trip to the preview and back.
  const browser = useTemplateBrowser()
  const { data: apps, loading: appsLoading } = useApps()
  const [selectedTemplate, setSelectedTemplate] = useState<ITemplate | null>(
    null,
  )

  if (selectedTemplate) {
    return (
      <TemplatePreview
        template={selectedTemplate}
        apps={apps}
        onBack={() => setSelectedTemplate(null)}
        onDismiss={onDismiss}
      />
    )
  }

  return (
    <TemplatePicker
      browser={browser}
      isLoading={browser.isLoading || appsLoading}
      onBack={onBack}
      onSelectTemplate={setSelectedTemplate}
    />
  )
}
