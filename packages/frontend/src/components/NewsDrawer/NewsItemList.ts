import dedent from 'dedent'

export interface NewsItemContent {
  date: Date
  title: string
  details: string
}

export const NEWS_ITEM_LIST: NewsItemContent[] = [
  {
    date: new Date('11 Aug 2023 GMT+8'),
    title: 'Welcome to Plumber',
    details: dedent`
      * Users can now ...
      * Users cannot ...
    `,
  },
]
