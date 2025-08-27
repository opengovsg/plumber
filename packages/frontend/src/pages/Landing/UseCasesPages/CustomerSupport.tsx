import { Text } from '@chakra-ui/react'

import GovTechLogo from '@/assets/landing/GOVTECH.png'

import ContentBox from './components/ContentBox'
import ContentSection from './components/ContentSection'
import Quote from './components/Quote'
import SummarySection from './components/SummarySection'
import UseCaseLanding from './UseCaseLanding'

function FirstContentBox() {
  return (
    <ContentBox headerText="Limitations of email-based support">
      <Text>
        GovTech’s employee support operated entirely through traditional email
        correspondence. Emails provided no mechanism for tracking query volumes,
        measuring response times, or monitoring staff workload distribution.
        Queries required manual forwarding between departments, causing delays.
      </Text>

      <Text>
        Additionally, management lacked visibility into recurring issues or
        trending concerns across the organization, preventing strategic
        improvements to employee services.
      </Text>
    </ContentBox>
  )
}

function SecondContentBox() {
  return (
    <ContentBox headerText="Building an automated system">
      <Text>
        The manual and error-prone tasks in this workflow made it suitable for
        automation. Quan Wei chose to use two products, FormSG and Plumber,
        because they were easy to use and implement quickly. Automating this
        workflow only took him a day.
      </Text>

      <Text>
        He managed to build a fully automated workflow where employees would
        submit their enquiries through a form that gets routed to relevant
        departments automatically. On top of this, he also built tracking
        capabilities to ensure departments meet service level agreements.
      </Text>
    </ContentBox>
  )
}

function ThirdContentBox() {
  return (
    <ContentBox headerText="Enhanced operations and strategic insights">
      <Text>
        Manual work is greatly reduced with automated routing of queries to
        relevant departments. The new tracking capabilities have enabled
        visibility on real-time progress for each query, ensuring consistent
        service with accountability that email systems could not provide. The HR
        team can now spot repeated problems and prevent them rather than just
        responding to each case separately.
      </Text>

      <Quote
        quote="Invest ten hours in automation to save countless hours for innovation."
        author="Quan Wei"
        authorTitle="CIO office, GovTech"
      />
    </ContentBox>
  )
}

export default function CustomerSupport() {
  return (
    <UseCaseLanding>
      <SummarySection
        category="Customer Support"
        image={GovTechLogo}
        title="How GovTech automates employee support tickets to stay on top of queries and better serve employees"
        description="Managing enquiries from current and former GovTech staff through email systems lacked tracking capabilities, making it impossible to measure performance, monitor workload, or identify common staff concerns"
        benefits={[
          '**Organised enquiry management** with tracking and response coordination',
          '**Data-driven decision making** through analytics on common and trending issues',
          '**Faster response times and better accountability** with enhanced monitoring',
        ]}
      />

      <ContentSection
        contentBoxes={
          <>
            <FirstContentBox />
            <SecondContentBox />
            <ThirdContentBox />
          </>
        }
      />
    </UseCaseLanding>
  )
}
