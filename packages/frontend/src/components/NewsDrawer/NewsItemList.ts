import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: new Date('11 Aug 2023 GMT+8'),
    title: 'Welcome to Plumber',
    details: dedent`
      * Users can now ...
      * Users cannot ...
    `,
  },
]
