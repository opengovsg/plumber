import dedent from 'dedent'

import ForEachAnimation from '../assets/ForEach.json'

export const FOR_EACH_ITEM_LIST = [
  {
    title: 'How to use for each item',
    details: dedent`
    This action lets you repeat the same steps for multiple items. These items can be rows from your Tiles/M365 tables, or FormSG checkbox options.
    `,
    multimedia: {
      animationData: ForEachAnimation,
    },
  },
  {
    title: 'For each item',
    details: dedent`
    Example use cases:
      * Send individual emails to a list of unconfirmed event attendees, reminding them to RSVP for an upcoming event.


      * Retrieve a list of your team members and find each person's assigned tasks for the week, then send a personalized email to each person with their tasks.


      * Go through each checkbox option in a FormSG submission and send emails to different recipients based on the selected options.
    `,
  },
]
