import { DateTime } from 'luxon'

export function createBodyErrorMessage(flowName: string): string {
  const currDateTime = DateTime.now().toFormat('MMM dd yyyy, HH:mm:ss')
  const bodyMessage = `
    Dear user,
    <br>
    <br>
    We have detected that your pipe: <strong>${flowName}</strong>, from plumber.gov.sg has failed as of ${currDateTime}.
    <br>
    Several scenarios could have caused this issue:
    <ol>
      <li>One of the apps you are using may be down.</li>
      <li>Some parts of the pipe you have set up may not be working as intended.</li>
    </ol>
    <br>
    Please check https://status.plumber.gov.sg/ to see if the status for Plumber is green or not. If one of the apps you are using are down, the plumber team would've already been alerted as well. 
    <br>
    <br>
    If the pipe issue is urgent, please log in to plumber.gov.sg and check the pipe. Please retry the pipe under the executions tab subsequently. Otherwise, you may respond to this email and request assistance from the Plumber support team.
    <br>
    <br>
    Regards,
    <br>
    Plumber Team
  `
  return bodyMessage
}
