import dedent from 'dedent'

import ForEachAnimation from '../assets/ForEach.json'

export const FOR_EACH_ITEM_LIST = [
  {
    title: 'How to use for each item',
    details: dedent`
    This action is used to repeat actions on multiple items at a time. Items can be rows in your Tiles/M365 tables or FormSG checkbox options.

    Example use case shown above: send individualised emails to a list of unconfirmed event attendees to remind them to RSVP for an upcoming event.
    `,
    multimedia: {
      animationData: ForEachAnimation,
    },
  },
]
