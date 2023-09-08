export default function generateTimestamp(date: string, time: string): number {
  // if no time is given, dateString will be 06 Sep 2023  GMT+8 for e.g.
  const dateString = `${date} ${time} GMT+8`
  const generatedDate = new Date(dateString)
  return generatedDate.getTime()
}
