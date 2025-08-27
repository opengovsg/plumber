import dedent from 'dedent'

import NptdLogo from '@/assets/landing/nptd.png'
import MarkdownRenderer from '@/components/MarkdownRenderer'

import ContentBox, { CommonMdComponents } from './components/ContentBox'
import ContentSection from './components/ContentSection'
import SummarySection from './components/SummarySection'
import UseCaseLanding from './UseCaseLanding'

function FirstContentBox() {
  return (
    <ContentBox headerText="The vision">
      <MarkdownRenderer
        source={dedent`
        The team behind the SG60 Baby Gift initiative aimed to ensure a seamless citizen experience by:

        - Developing processes to coordinate large-scale registration, supported by government digital platforms to ensure efficient processing while minimising human error
        - Coordinating distribution across different stakeholders for community events and home deliveries

      `}
        components={CommonMdComponents}
      />
    </ContentBox>
  )
}

function SecondContentBox() {
  return (
    <ContentBox headerText="Paving the way for transformation">
      <MarkdownRenderer
        source={dedent`
        Jihua, a digital business analyst at PMO-SG, utilised Plumber as the central engine, together with FormSG and DistributeSG, to implement a streamlined process from Gift registration to distribution. Plumber's workflow automation helps:

        - Officers ensure accurate and efficient registration processing
        - Officers coordinate Gift distribution across different channels
        - Parents receive timely and personalised notifications
      `}
        components={CommonMdComponents}
      />
    </ContentBox>
  )
}

export default function HumanResource() {
  return (
    <UseCaseLanding>
      <SummarySection
        category="Campaign Management"
        image={NptdLogo}
        title="How the National Population and Talent Division Implemented the SG60 Baby Gift Initiative with Digital Solutions"
        description="To commemorate Singapore's 60th year of independence, all Singapore Citizen babies born in 2025 receive the SG60 Baby Gift — a nationwide initiative requiring coordination across multiple government agencies and community partners"
        benefits={[
          '**Substantial time savings** through process automation',
          '**Significant cost savings** by leveraging existing government platforms',
          '**High citizen satisfaction** with the Gift registration process',
        ]}
      />

      <ContentSection
        contentBoxes={
          <>
            <FirstContentBox />
            <SecondContentBox />
          </>
        }
      />
    </UseCaseLanding>
  )
}
