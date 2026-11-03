import dayjs from './utils/timezone'

export default function globalSetup() {
  console.log({ now: dayjs() })
}
