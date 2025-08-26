import { Text } from '@chakra-ui/react'

import CaasLogo from '@/assets/landing/CaasLogo.png'

import ContentBox from './components/ContentBox'
import ContentSection from './components/ContentSection'
import Quote from './components/Quote'
import SummarySection from './components/SummarySection'
import UseCaseLanding from './UseCaseLanding'

function FirstContentBox() {
  return (
    <ContentBox headerText="Manual process challenges">
      <Text>
        Before using Plumber, the team handled many manual tasks in their event
        management process. First, each participant needed to receive a
        confirmation email with webinar details. Second, registration numbers
        had to be collected by hand every week. Third, after gathering these
        numbers, staff had to manually create update emails for supervisors and
        the rest of the team.
      </Text>
    </ContentBox>
  )
}

function SecondContentBox() {
  return (
    <ContentBox headerText="Implementing process improvements">
      <Text>
        Fang Jie, part of the team handling webinars, decided to use Plumber
        when he realised too many manual tasks were being completed.
      </Text>

      <Text>
        The first improvement focused on confirmation emails. The new automated
        version became more personalised than before and included webinar
        details. The system immediately sent these emails when someone
        registered. He also set up automatic reminder emails that sent
        participants the webinar link one week before the webinar date.
      </Text>

      <Text>
        He then addressed the need to manually collect registration numbers.
        Each sign-up was automatically recorded in a spreadsheet, and numbers
        were organised and sent to supervisors and team members via email.
      </Text>
    </ContentBox>
  )
}

function ThirdContentBox() {
  return (
    <ContentBox
      headerText="End-to-end event management
"
    >
      <Text>
        With this approach, each phase of event management became simplified.
        The team can easily copy this process and use it for other events as
        well.
      </Text>

      <Quote
        quote="My colleagues were glad to know that the system runs reliably even when I’m out of office, such as when I’m on leave or medical certificate (MC)."
        author="Fang Jie"
        authorTitle="Singapore Aviation Academy Division
"
      />
    </ContentBox>
  )
}

export default function Operations() {
  return (
    <UseCaseLanding>
      <SummarySection
        category="Operations"
        image={CaasLogo}
        title="How Civil Aviation Authority of Singapore simplified event management for their webinars"
        description="Webinars occur frequently with hundreds of participants each time. Managing these events manually became extremely time-consuming for the team"
        benefits={[
          '**100% time saved** by fully automating this process',
          '**Eliminated human errors** by removing manual data entry',
          '**Improved experience** for webinar participants',
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
