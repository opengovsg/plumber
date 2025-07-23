import IntegrationsAnimation from '@/assets/landing/Integrations.json'
import NoCode from '@/assets/landing/NoCode.svg'

import { FeatureSection } from './components/FeatureSection'

const features1 = [
  {
    name: 'Build with our visual editor.',
    description:
      'Choose what happens in your workflow, fill in some fields and you are all set.',
  },
  {
    name: 'Build faster with templates.',
    description:
      'Get up and running instantly with customizable templates that have been tried and tested by other agencies.',
  },
]

const features2 = [
  {
    name: 'WoG tools and commercial services.',
    description: 'We are integrated with M365 Excel, FormSG, Postman and more.',
  },
  {
    name: 'Built in tools.',
    description:
      'Expand what your workflow does with our built in tools that can handle logic.',
  },
  {
    name: 'Connect to your favourite tools with just a few clicks.',
    description: 'No API keys needed.',
  },
]

export default function FeatureSectionList() {
  return (
    <>
      <FeatureSection
        title="No code needed"
        features={features1}
        imageSrc={NoCode}
        imagePosition="right"
      />

      <FeatureSection
        title="Connect with tools you are familiar with"
        features={features2}
        lottieData={IntegrationsAnimation}
        imagePosition="left"
      />
    </>
  )
}
