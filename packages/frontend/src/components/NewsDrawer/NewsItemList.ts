import dedent from 'dedent'

import IfThenAnimation from './assets/If-ThenGraphic.json'
import { NewsItemProps } from './NewsItem'
import { NEW_ENHANCEMENT_TAG, NEW_FEATURE_TAG } from './NewsItemTag'

const IF_THEN_EXTERNAL_LINK =
  'https://guide.plumber.gov.sg/user-guides/actions/toolbox'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
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
