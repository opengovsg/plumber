import type { ITemplate, ITemplateStep } from '@plumber/types'

import {
  CREATE_TEMPLATE_STEP_VARIABLE,
  FORMSG_SAMPLE_URL_DESCRIPTION,
  USER_EMAIL_PLACEHOLDER,
} from './constants'

const ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_ID =
  '8f0a3052-db94-45de-b984-29647f2b09c9'

/**
 * The divisions Pair classifies each enquiry into. Each one becomes a Pair
 * category, an if-then branch, and a routing email, so they must stay in sync.
 */
const DIVISIONS = ['Finance', 'IT', 'HR', 'Facilities'] as const

/**
 * Pair prompt (stored as HTML, since the prompt field is a rich-text editor).
 * References the form submission from step 1 via a variable placeholder that
 * the user re-points after copying the template.
 */
const PAIR_PROMPT = [
  '<p>You are a support officer for a government agency. Read the enquiry below and decide which division should handle it:</p>',
  '<p></p>',
  '<p>',
  '<span ',
  'data-type="variable" ',
  'data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the enquiry from step 1" ',
  'data-label="Replace this with the enquiry from step 1" ',
  'data-value>',
  '{{step.00000000-0000-0000-0000-000000000000.Replace this with the enquiry from step 1}}',
  '</span>',
  '</p>',
  '<p></p>',
  '<p>Pick the single division best suited to handle this enquiry, then write a one to two sentence summary of what the enquirer needs.</p>',
].join('')

// If-then branch that fires when Pair classifies the enquiry as `division`.
function createDivisionBranch(
  division: string,
  position: number,
): ITemplateStep {
  return {
    position,
    appKey: 'toolbox',
    eventKey: 'ifThen',
    parameters: {
      depth: 0,
      branchName: division,
      conditions: [
        {
          is: 'is',
          text: division,
          field: CREATE_TEMPLATE_STEP_VARIABLE(
            'Replace with department from step 2',
          ),
          condition: 'equals',
        },
      ],
    },
  }
}

// Routing email sent to a division when its branch is taken.
function createDivisionEmail(
  division: string,
  position: number,
): ITemplateStep {
  return {
    position,
    appKey: 'postman',
    eventKey: 'sendTransactionalEmail',
    parameters: {
      body: `<p style="margin: 0">A new enquiry has been routed to the ${division} division.</p><p style="margin: 0"></p><p style="margin: 0">From: ${CREATE_TEMPLATE_STEP_VARIABLE(
        'Replace with the enquirer from step 1',
      )}</p><p style="margin: 0"></p><p style="margin: 0">What they need: ${CREATE_TEMPLATE_STEP_VARIABLE(
        'Replace with the summary from step 2',
      )}</p><p style="margin: 0"></p><p style="margin: 0">Please follow up within 3 working days. Thank you!</p>`,
      subject: `New ${division} enquiry received`,
      senderName: 'Enquiry routing',
      destinationEmail: USER_EMAIL_PLACEHOLDER,
    },
  }
}

export const ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_TEMPLATE: ITemplate = {
  id: ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_ID,
  name: 'Route support enquiries with Pair',
  description:
    'Use Pair to read incoming form enquiries and route to the right division',
  iconName: 'BiDirections',
  tags: ['new'],
  // Steps: formsg --> Pair (classify) --> one if-then + email per division
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/6a32a65e000886c246640e50',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'pair',
      eventKey: 'sendPrompt',
      parameters: {
        prompt: PAIR_PROMPT,
        responseFields: [
          {
            fieldType: 'category',
            fieldName: 'Department',
            fieldCategories: DIVISIONS.join(', '),
          },
          {
            fieldType: 'text',
            fieldName: 'Summary',
          },
        ],
      },
    },
    ...DIVISIONS.flatMap((division, index): ITemplateStep[] => {
      const branchPosition = 3 + index * 2
      return [
        createDivisionBranch(division, branchPosition),
        createDivisionEmail(division, branchPosition + 1),
      ]
    }),
  ],
}
