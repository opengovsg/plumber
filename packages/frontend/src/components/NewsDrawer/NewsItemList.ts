import dedent from 'dedent'

import * as URLS from '@/config/urls'

import IfThenAnimation from './assets/If-ThenGraphic.json'
import { NewsItemProps } from './NewsItem'
import { NEW_ENHANCEMENT_TAG, NEW_FEATURE_TAG } from './NewsItemTag'

const IF_THEN_EXTERNAL_LINK =
  'https://guide.plumber.gov.sg/user-guides/actions/toolbox'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2024-10-23',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Tile transfer`,
    details: dedent`
      You can now transfer ownership of **tiles** to other users. Editors can now also connect tiles to their pipes.
    `,
  },
  {
    date: '2024-10-04',
    tag: NEW_FEATURE_TAG,
    title: 'Save time building workflows with Templates!',
    details: `Each template comes with pre-selected steps and content set up for you. Use them as starting points or to get inspired by what others are creating. We are continuously working on adding more relevant templates to speed up workflow building. If you need a template, put in a request [here](${URLS.TEMPLATES_FORM_LINK})!`,
    multimedia: {
      url: 'https://file.go.gov.sg/plumber-templates-whats-new.png',
    },
  },
  {
    date: '2024-09-06',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Improved step testing`,
    details: dedent`
      🧪 **Test Step** and **Test again** now test only the specific step. Previously, all prior steps were run. We've updated this behaviour so that only the specific step will be run during testing.
    `,
  },
  {
    date: '2024-08-02',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Improvements we made`,
    details: dedent`
      ⚒️ Create a tile when you create your pipe - You can now create new tiles and add new columns directly when setting up your create row step.
      
      ✔ Simplified checkbox responses for FormSG - Checkbox responses are now combined into one variable, options are displayed and separated by commas. This makes checkbox variables less cluttered and checkbox data easier to use in your subsequent steps.
    `,
  },
  {
    date: '2024-06-24',
    tag: NEW_FEATURE_TAG,
    title: `New integration - M365 Excel`,
    details: `We heard you! Now you can create, find and update rows in your Excel spreadsheets! This integration is only available for public officers who have access to SG Government Sharepoint. Read [our guide](https://guide.plumber.gov.sg/user-guides/actions/m365-excel) on how to set this up!`,
    multimedia: {
      url: 'https://file.go.gov.sg/plumber-m365-whats-new.png',
    },
  },
  {
    date: '2024-05-09',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Improvements we made`,
    details: dedent`
      ⚙️ Pipe settings — transfer pipes and customise the frequency of error notifications. You can find this in each pipe.

      🧪 FormSG mock data — we’ve also improved one-click testing to check if your step is working correctly, without needing to submit a form.      

      ❓ If empty (for toolbox actions) — we now check for empty data values and prevent errors.
    `,
  },
  {
    date: '2024-04-23',
    tag: NEW_FEATURE_TAG,
    title: 'Introducing Tiles!',
    details:
      'Tiles is a simple database to view, store and automate your data! With Tiles, you can seamlessly integrate your data without the hassle of connection setups, and also consolidate all your data and pipes in one platform.',
    multimedia: {
      url: 'https://file.go.gov.sg/tiles-whats-new.png',
    },
  },
  {
    date: '2024-04-23',
    tag: NEW_FEATURE_TAG,
    title: 'New action - Formatter',
    details: dedent`
      Struggling with date formats or needing to schedule reminders based on form submissions? Meet Formatter!
      
      Simplify data handling by formatting, manipulating, and converting it to your liking. Whether it's beautifying dates or performing time calculations, Formatter's got you covered. Stay tuned for even more features by Formatter!
    `,
    multimedia: {
      url: 'https://file.go.gov.sg/formatter-whats-new.png',
    },
  },
  {
    date: '2024-03-27',
    tag: NEW_FEATURE_TAG,
    title: 'LetterSG integration',
    details: dedent`
    You can now integrate LetterSG into your pipes! LetterSG allows you to send personalised e-letters to members of public for use cases such as sending fine letters, notices and certificates. Onboard your templates with the LetterSG team [here](https://go.gov.sg/lettersg-onboarding) and learn how to start using this in your workflow!
    `,
    multimedia: {
      url: 'https://file.go.gov.sg/letters-graphic.png',
    },
  },
  {
    date: '2023-11-30',
    tag: NEW_FEATURE_TAG,
    title: 'Rich text editor for email body',
    details: dedent`
      * Email body can now be formatted easily with our brand new rich-text editor with elements like table, list, headings and images.
      * There might be some backward compatbility issues if you are editing old pipes that use raw HTML. Keep a look out for our emails for more details.
    `,
  },
  {
    date: '2023-11-23',
    tag: NEW_FEATURE_TAG,
    title: 'Email attachments for Postman action',
    details: dedent`
      * Email attachments are now supported.
      * Checkout the supported file types [here](https://guide.postman.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types).
    `,
    multimedia: {
      url: 'https://file.go.gov.sg/clipplumber.png',
    },
  },
  {
    date: '2023-10-18',
    tag: NEW_FEATURE_TAG,
    title: `Introducing If-then!`,
    details: dedent`
      **If-then** uses branching logic to perform actions when certain conditions are met! Look for this feature under Toolbox when you add an action! Read [our guide](${IF_THEN_EXTERNAL_LINK}) to understand how to use this feature to do more with your pipes!
    `,
    multimedia: {
      animationData: IfThenAnimation,
    },
  },
  {
    date: '2023-10-16',
    tag: NEW_ENHANCEMENT_TAG,
    title: 'Plumber default email credentials for Postman action',
    multimedia: {
      url: 'https://file.go.gov.sg/plumber-x-postman-small.png',
    },
    details: dedent`
      * Postman credentials are not required for sending email action anymore
      * All future emails will be sent from donotreply@plumber.gov.sg
    `,
  },
  {
    date: '2023-10-11',
    tag: NEW_FEATURE_TAG,
    title: `Introducing Toolbox`,
    details: dedent`
      Toolbox is a new app that you can find when you add an action. This will contain built in tools that can enhance your workflows! Logic has been moved into Toolbox and renamed to **Only continue if**. Stay tuned for the release of our new feature **If-then** in the coming weeks!
    `,
  },
  {
    date: '2023-10-11',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Enhancements this week!`,
    details: dedent`
      * Email notifications for pipe failures
          * Sent on the first failed execution for a pipe
          * You will only receive a maximum of 1 per day per pipe
      

      * Variable values are now displayed
          * Values will now be shown in the pill together with the variable name
    `,
  },
  {
    date: '2023-08-30',
    tag: NEW_FEATURE_TAG,
    title: `What's new on Plumber`,
    details: dedent`
      Stay updated on new features, bug fixes and enhancements through this drawer. 
      
      The Plumber team has been working hard to release some new features and improvements to your overall user experience so keep a look out for these!
    `,
  },
  {
    date: '2023-08-30',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Automatic FormSG webhook configuration`,
    details: dedent`
      * Webhook URL is automatically set when you connect your form.
      * Save the hassle of navigating through FormSG.
    `,
  },
]
